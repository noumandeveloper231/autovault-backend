import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log("[email] RESEND_API_KEY missing. Email not sent.", { to, subject });
    return;
  }

  const result = await resend.emails.send({
    from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }
}
