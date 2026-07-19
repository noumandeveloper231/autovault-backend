import { prisma } from "../lib/prisma.js";
import { enqueueJob } from "../lib/redis.js";
import { sendEmail } from "../utils/email.js";
import { env } from "../config/env.js";
import { logger } from "../common/logger.js";

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

async function getUpcomingRemindersForDealership(dealership) {
  const settings = await prisma.dealershipTaxSettings.findUnique({
    where: { dealershipId: dealership.id },
  });
  const reminderDays = settings?.reminderDays ?? 14;

  const periods = await prisma.taxFilingPeriod.findMany({
    where: {
      dealershipId: dealership.id,
      status: { in: ["open", "due"] },
    },
    orderBy: { dueDate: "asc" },
    include: { _count: { select: { deals: true } } },
  });

  return periods
    .map((period) => ({
      periodId: period.id,
      periodName: period.name,
      dueDate: period.dueDate,
      daysUntilDue: daysUntil(period.dueDate),
      vehicleCount: period._count.deals,
      status: period.status,
    }))
    .filter((r) => r.daysUntilDue <= reminderDays);
}

function buildReminderEmailHtml({ ownerName, dealershipName, reminders }) {
  const rows = reminders
    .map(
      (r) =>
        `<tr><td>${r.periodName}</td><td>${new Date(r.dueDate).toLocaleDateString()}</td><td>${r.daysUntilDue}</td><td>${r.vehicleCount}</td></tr>`,
    )
    .join("");

  const dashboardUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/dashboard/state-tax`;

  return `
    <p>Hi ${ownerName},</p>
    <p>The following sales tax filing periods for <strong>${dealershipName}</strong> are due soon:</p>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead><tr><th>Period</th><th>Due Date</th><th>Days Left</th><th>Vehicles</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${dashboardUrl}">Open State Tax dashboard</a></p>
  `;
}

async function findRecipient(dealershipId) {
  return prisma.user.findFirst({
    where: {
      dealershipId,
      role: { in: ["owner", "manager"] },
      isActive: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { email: true, fullName: true },
  });
}

async function sendReminderEmail(dealership, reminders) {
  const recipient = await findRecipient(dealership.id);
  if (!recipient?.email) {
    return { sent: false, error: "No owner/manager email found" };
  }

  const html = buildReminderEmailHtml({
    ownerName: recipient.fullName ?? "Dealer",
    dealershipName: dealership.name,
    reminders,
  });

  const enqueued = await enqueueJob("email", {
    type: "tax_reminder",
    to: recipient.email,
    subject: `Sales Tax Filing Reminder — ${dealership.name}`,
    html,
    dealershipId: dealership.id,
  });

  if (enqueued) {
    return { sent: true, method: "queued" };
  }

  try {
    await sendEmail({
      to: recipient.email,
      subject: `Sales Tax Filing Reminder — ${dealership.name}`,
      html,
    });
    return { sent: true, method: "direct" };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

/**
 * Scan all active dealerships for tax periods due within reminderDays.
 * Enqueues email jobs via Redis or sends directly when Redis is unavailable.
 */
export async function runTaxReminders() {
  const dealerships = await prisma.dealership.findMany({
    where: { status: "active", deletedAt: null },
    select: { id: true, name: true },
  });

  const results = [];

  for (const dealership of dealerships) {
    const reminders = await getUpcomingRemindersForDealership(dealership);

    if (reminders.length === 0) {
      results.push({
        dealershipId: dealership.id,
        name: dealership.name,
        sent: 0,
        errors: [],
      });
      continue;
    }

    const delivery = await sendReminderEmail(dealership, reminders);
    results.push({
      dealershipId: dealership.id,
      name: dealership.name,
      sent: delivery.sent ? reminders.length : 0,
      errors: delivery.sent ? [] : [delivery.error ?? "Unknown error"],
      method: delivery.method,
    });
  }

  logger.info({ count: results.length }, "[tax-reminders] completed");
  return { ok: true, results };
}
