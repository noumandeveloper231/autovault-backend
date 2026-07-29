import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../config/env.js";
import { renderTemplate, getTemplate } from "./email-templates.js";
import { logger } from "../common/logger.js";

const brevo = env.BREVO_API_KEY
  ? new BrevoClient({ apiKey: env.BREVO_API_KEY, maxRetries: 2 })
  : null;

function normalizeRecipients(recipients) {
  if (!recipients) return [];
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list
    .filter(Boolean)
    .map((r) => {
      if (typeof r === "string") return { email: r };
      return { email: r.email, name: r.name || undefined };
    });
}

function getSender(sender) {
  if (sender) {
    return {
      name: sender.name || env.BREVO_SENDER_NAME,
      email: sender.email || env.BREVO_SENDER_EMAIL,
    };
  }
  return { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL };
}

function formatBrevoError(err) {
  return {
    status: err?.statusCode || err?.status || err?.response?.status,
    body: err?.body || err?.response?.body || null,
    message: err?.message || String(err),
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  templateName,
  templateData,
  cc,
  bcc,
  replyTo,
  sender,
  attachments,
}) {
  if (!brevo) {
    logger.warn({ to, subject }, "[email] BREVO_API_KEY missing. Email not sent.");
    return null;
  }

  const toRecipients = normalizeRecipients(to);
  if (toRecipients.length === 0) {
    throw new Error("sendEmail: at least one recipient is required");
  }

  const renderedHtml = templateName
    ? renderTemplate(templateName, templateData || {})
    : html;

  if (!renderedHtml) {
    throw new Error("sendEmail: html or templateName is required");
  }

  const payload = {
    subject,
    htmlContent: renderedHtml,
    sender: getSender(sender),
    to: toRecipients,
  };

  if (cc) payload.cc = normalizeRecipients(cc);
  if (bcc) payload.bcc = normalizeRecipients(bcc);
  if (replyTo) {
    payload.replyTo =
      typeof replyTo === "string"
        ? { email: replyTo }
        : { email: replyTo.email, name: replyTo.name };
  }

  if (attachments?.length) {
    payload.attachment = attachments.map((a) => ({
      name: a.name || "attachment",
      content: a.content,
    }));
  }

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail(payload);
    logger.info(
      {
        to: toRecipients.map((r) => r.email),
        subject,
        messageId: result?.messageId || result?.body?.messageId || null,
      },
      "[email] sent",
    );
    return result;
  } catch (err) {
    logger.error(
      {
        ...formatBrevoError(err),
        to: toRecipients.map((r) => r.email),
        subject,
      },
      "[email] send failed",
    );
    throw err;
  }
}

export async function sendBulkEmails(emails) {
  if (!brevo) {
    logger.warn(
      { count: emails.length },
      "[email] BREVO_API_KEY missing. Bulk emails not sent.",
    );
    return [];
  }

  const results = [];
  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ success: true, messageId: result?.messageId, to: email.to });
    } catch (err) {
      results.push({ success: false, error: err.message, to: email.to });
    }
  }
  return results;
}

export { getTemplate, renderTemplate };
