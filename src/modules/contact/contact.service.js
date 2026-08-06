import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import {
  contactInboundEmail,
  contactAutoReplyEmail,
} from "../../utils/email-templates.js";
import { tooManyRequests, validationError } from "../../common/errors.js";
import { logger } from "../../common/logger.js";

const recentByIp = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const key = ip || "unknown";
  const now = Date.now();
  const entry = recentByIp.get(key) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  recentByIp.set(key, entry);
  if (entry.count > MAX_PER_WINDOW) {
    throw tooManyRequests("Too many contact requests. Please try again later.");
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitContact(payload, ip) {
  if (payload.website) {
    // Silent success for bots
    return { ok: true };
  }

  checkRateLimit(ip);

  const first = payload.first.trim();
  const last = (payload.last || "").trim();
  const company = (payload.company || "").trim();
  const email = payload.email;
  const phone = (payload.phone || "").trim();
  const state = (payload.state || "").trim();
  const message = (payload.message || "").trim();

  if (!first || !email) {
    throw validationError("First name and email are required.");
  }

  const fullName = [first, last].filter(Boolean).join(" ");
  const to = env.CONTACT_TO_EMAIL || "privacy@autovault360.com";
  const siteUrl = String(env.FRONTEND_URL || "https://www.autovault360.com").replace(
    /\/+$/,
    "",
  );

  const templateData = {
    firstName: escapeHtml(first),
    fullName: escapeHtml(fullName),
    email: escapeHtml(email),
    company: company ? escapeHtml(company) : "",
    phone: phone ? escapeHtml(phone) : "",
    state: state ? escapeHtml(state) : "",
    message: message ? escapeHtml(message) : "",
    supportEmail: escapeHtml(to),
    siteUrl,
  };

  try {
    await sendEmail({
      to,
      subject: `AutoVault Contact — ${fullName}`,
      html: contactInboundEmail(templateData),
      replyTo: { email, name: fullName },
    });
  } catch (err) {
    logger.error({ err, email }, "[contact] failed to send email");
    throw err;
  }

  try {
    await sendEmail({
      to: { email, name: fullName },
      subject: "We got your message — AutoVault",
      html: contactAutoReplyEmail(templateData),
      replyTo: { email: to, name: "AutoVault" },
    });
  } catch (err) {
    // Internal notice already delivered; don't fail the form if auto-reply bounces.
    logger.error({ err, email }, "[contact] failed to send auto-reply");
  }

  return { ok: true };
}
