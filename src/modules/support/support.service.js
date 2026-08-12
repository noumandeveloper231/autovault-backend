import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import { notFound, validationError } from "../../common/errors.js";
import { logger } from "../../common/logger.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeSupportMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    dealershipName: row.dealership?.name || null,
    userId: row.userId,
    name: row.name,
    role: row.role,
    topic: row.topic,
    subject: row.subject,
    priority: row.priority,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSupportMessage({
  dealershipId,
  userId,
  name,
  role,
  topic,
  subject,
  priority,
  message,
}) {
  const cleanSubject = String(subject || "").trim();
  const cleanMessage = String(message || "").trim();
  if (!cleanSubject || !cleanMessage) {
    throw validationError("Add a subject and a message so we can help.");
  }

  const dealership = await prisma.dealership.findFirst({
    where: { id: dealershipId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!dealership) {
    throw validationError("Dealership not found.");
  }

  const row = await prisma.supportMessage.create({
    data: {
      dealershipId,
      userId: userId || null,
      name: String(name || "Team member").trim() || "Team member",
      role: String(role || "user").trim() || "user",
      topic: String(topic || "General").trim() || "General",
      subject: cleanSubject,
      priority: priority || "Normal",
      message: cleanMessage,
      status: "new",
    },
    include: { dealership: { select: { name: true } } },
  });

  const to = env.CONTACT_TO_EMAIL || "support@autovault.com";
  try {
    await sendEmail({
      to,
      subject: `[Support] ${row.priority} — ${row.subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#10261a">
          <h2 style="margin:0 0 12px">New support message</h2>
          <p><strong>Dealership:</strong> ${escapeHtml(dealership.name)}</p>
          <p><strong>From:</strong> ${escapeHtml(row.name)} (${escapeHtml(row.role)})</p>
          <p><strong>Topic:</strong> ${escapeHtml(row.topic)}</p>
          <p><strong>Priority:</strong> ${escapeHtml(row.priority)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(row.subject)}</p>
          <p style="white-space:pre-wrap">${escapeHtml(row.message)}</p>
        </div>
      `,
    });
  } catch (err) {
    // Persist succeeded; don't fail the request if notify email bounces.
    logger.error({ err, supportMessageId: row.id }, "[support] failed to send notify email");
  }

  return serializeSupportMessage(row);
}

export async function listSupportMessages({ status } = {}) {
  const where = {};
  if (status && status !== "all") {
    where.status = status === "unread" ? "new" : status;
  }

  const rows = await prisma.supportMessage.findMany({
    where,
    include: { dealership: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    messages: rows.map(serializeSupportMessage),
  };
}

export async function updateSupportMessageStatus(id, status) {
  const existing = await prisma.supportMessage.findUnique({
    where: { id },
    include: { dealership: { select: { name: true } } },
  });
  if (!existing) {
    throw notFound("Support message not found.");
  }

  const updated = await prisma.supportMessage.update({
    where: { id },
    data: { status },
    include: { dealership: { select: { name: true } } },
  });

  return serializeSupportMessage(updated);
}
