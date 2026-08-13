import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const welcomeEmailHtml = readFileSync(
  join(__dirname, "..", "emails", "subscription-welcome.html"),
  "utf8",
);

const templates = {};

function registerTemplate(name, fn) {
  templates[name] = fn;
}

export function getTemplate(name) {
  return templates[name] || null;
}

export function renderTemplate(name, data) {
  const fn = templates[name];
  if (!fn) throw new Error(`Email template "${name}" not found. Available: ${Object.keys(templates).join(", ")}`);
  return fn(data);
}

export function listTemplates() {
  return Object.keys(templates);
}

registerTemplate("subscriptionWelcome", ({ loginEmail, temporaryPassword }) =>
  welcomeEmailHtml
    .replaceAll("{{email}}", loginEmail)
    .replaceAll("{{tempPassword}}", temporaryPassword),
);

registerTemplate("userInvitation", ({
  name,
  role,
  roleLabel,
  dealership,
  acceptUrl,
  eyebrow,
  accent,
  bodyHtml,
}) => {
  const label =
    roleLabel ||
    String(role || "team member").replace(/_/g, " ");
  const badge = eyebrow || "Team Invitation";
  const accentColor = accent || "#46D392";
  const greeting = name ? `Hi ${name},` : "You've been invited.";
  const dealershipBit = dealership
    ? ` for <span style="color:#EAECEF;font-weight:700;">${dealership}</span>`
    : "";
  const defaultBody = `You have been invited to join AutoVault as <strong style="color:#EAECEF;">${label}</strong>${dealershipBit}. Accept below to set your password and activate your login.`;
  return `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:${accentColor};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${badge}</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">${greeting}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <p style="margin:0 0 12px 0;color:#A5AFBC;font-size:15px;line-height:1.6;">${bodyHtml || defaultBody}</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;margin-top:6px;">
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Role</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:${accentColor};font-size:16px;font-weight:700;">${label}</td>
                  </tr>
                  ${
                    dealership
                      ? `<tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Dealership</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${dealership}</td>
                  </tr>`
                      : ""
                  }
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${acceptUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Accept Invitation</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">This link expires in 7 days. If you were not expecting this invite, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;
});

registerTemplate("taxReminder", ({ ownerName, dealershipName, rows, dashboardUrl }) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#F5A623;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Tax Reminder</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">Filing periods due soon</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <p style="margin:0 0 16px 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Hi ${ownerName}, the following sales tax filing periods for <strong style="color:#EAECEF;">${dealershipName}</strong> are due soon:</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;overflow:hidden;">
                  <tr style="background:#171C22;">
                    <td style="padding:10px 14px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;border-bottom:1px solid #232A32;">Period</td>
                    <td style="padding:10px 14px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;border-bottom:1px solid #232A32;">Due Date</td>
                    <td style="padding:10px 14px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;border-bottom:1px solid #232A32;">Days Left</td>
                    <td style="padding:10px 14px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;border-bottom:1px solid #232A32;">Vehicles</td>
                  </tr>
                  ${rows}
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open State Tax Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

registerTemplate("salesRepWelcome", ({ name, username, loginEmail, temporaryPassword, dealership, loginUrl }) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#1A1430 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#A78BFA;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Sales Rep Invitation</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:30px;line-height:1.15;color:#EAECEF;">Welcome, ${name}.</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">You've been added as a <span style="color:#C4B5FD;font-weight:700;">Sales Rep</span> for <span style="color:#EAECEF;font-weight:700;">${dealership}</span>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <p style="margin:0 0 16px 0;color:#A5AFBC;font-size:14px;line-height:1.6;">Use the credentials below to log in and start managing your deals.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Portal URL</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#A78BFA;font-size:14px;font-weight:500;">${loginUrl}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Username</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${username}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Login Email</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${loginEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Temporary Password</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;">
                      <div style="display:inline-block;background:#171C22;border:1px dashed #8B5CF6;color:#C4B5FD;padding:10px 14px;border-radius:10px;font-family:'JetBrains Mono',Consolas,monospace;font-size:16px;font-weight:700;">${temporaryPassword}</div>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">For security, please change your password after your first login.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#8B5CF6;">
                      <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open AutoVault Login</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

registerTemplate("billingUpcomingReminder", ({
  name,
  dealership,
  planLabel,
  amount,
  dueDate,
  dashboardUrl,
}) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#F5A623;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Billing Reminder</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">Your plan renews in 3 days</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Hi ${name}, this is a heads-up for <span style="color:#EAECEF;font-weight:700;">${dealership}</span>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Plan</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${planLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Amount</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#46D392;font-size:18px;font-weight:700;">$${Number(amount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Billing date</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${dueDate}</td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">We&apos;ll charge the card on file on that date. You can update your payment method any time in Payment Settings.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open Payment Settings</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

registerTemplate("billingDueNotice", ({
  name,
  dealership,
  planLabel,
  amount,
  dueDate,
  dashboardUrl,
}) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Billing Today</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">Your subscription renews today</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Hi ${name}, today is the billing date for <span style="color:#EAECEF;font-weight:700;">${dealership}</span>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Plan</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${planLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Amount</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#46D392;font-size:18px;font-weight:700;">$${Number(amount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Billing date</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${dueDate}</td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Stripe will charge the card on file for your ${planLabel} plan. If anything looks off, update your payment method in Payment Settings.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open Payment Settings</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

registerTemplate("resetPassword", ({ name, email, resetUrl }) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Password Reset</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">Reset your password</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Hi ${name}, we received a request to reset your AutoVault password.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Account Email</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${email}</td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Click the button below to reset your password. This link expires in <span style="color:#F5A623;font-weight:700;">1 hour</span> and can only be used once.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Reset Password</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:12px;line-height:1.6;">If you didn't request this, you can safely ignore this email — someone probably entered your email address by mistake.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

function contactFieldRow(label, value, { topBorder = false, accent = false } = {}) {
  if (!value) return "";
  const border = topBorder ? "border-top:1px solid #232A32;" : "";
  const valueColor = accent ? "#46D392" : "#EAECEF";
  return `
    <tr>
      <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;${border}">${label}</td>
    </tr>
    <tr>
      <td style="padding:0 16px 14px 16px;color:${valueColor};font-size:15px;font-weight:600;line-height:1.45;">${value}</td>
    </tr>
  `;
}

function wrapTransactionalEmail({
  preheader = "",
  badge,
  badgeColor = "#46D392",
  title,
  introHtml = "",
  bodyHtml,
  headerTint = "#173021",
  footerHtml,
}) {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0A0D10;font-size:1px;line-height:1px;">${preheader}</div>`
    : "";
  const footer =
    footerHtml === undefined
      ? `<p style="margin:22px 0 0 0;color:#5A636D;font-size:12px;line-height:1.6;">AutoVault Support &middot; Sent from the dealership CRM.</p>`
      : footerHtml;
  return `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    ${pre}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,${headerTint} 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:${badgeColor};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${badge}</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.2;color:#EAECEF;">${title}</h1>
                ${introHtml ? `<p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">${introHtml}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                ${bodyHtml}
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function supportPriorityTheme(priority) {
  const key = String(priority || "Normal");
  if (key === "Urgent") {
    return {
      color: "#F07178",
      pillBg: "#3A1A1C",
      pillBorder: "#F07178",
      headerTint: "#301417",
      badge: "Urgent support",
      pill: "Urgent — reply ASAP",
    };
  }
  if (key === "Low") {
    return {
      color: "#A5AFBC",
      pillBg: "#1A1F26",
      pillBorder: "#3A424A",
      headerTint: "#1A1F26",
      badge: "Support request",
      pill: "Low priority",
    };
  }
  return {
    color: "#46D392",
    pillBg: "#173021",
    pillBorder: "#2C9257",
    headerTint: "#173021",
    badge: "Support request",
    pill: "Normal priority",
  };
}

function supportPriorityPill(theme) {
  return `<div style="display:inline-block;background:${theme.pillBg};border:1px solid ${theme.pillBorder};color:${theme.color};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:7px 12px;border-radius:999px;margin-bottom:16px;">${theme.pill}</div>`;
}

function supportCtaButton(href, label) {
  if (!href) return "";
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
      <tr>
        <td style="border-radius:10px;background:#2C9257;">
          <a href="${href}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${label}</a>
        </td>
      </tr>
    </table>`;
}

registerTemplate("contactInbound", ({
  fullName,
  email,
  company,
  phone,
  state,
  message,
  siteUrl,
}) => {
  const rows = [
    contactFieldRow("Name", fullName),
    contactFieldRow("Email", email, { topBorder: true, accent: true }),
    contactFieldRow("Company / Dealership", company, { topBorder: true }),
    contactFieldRow("Mobile number", phone, { topBorder: true }),
    contactFieldRow("State", state, { topBorder: true }),
  ].join("");

  return `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Get in touch</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:30px;line-height:1.15;color:#EAECEF;">New Contact Us message</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Someone reached out from the Contact form. Reply directly to this email to respond to <span style="color:#EAECEF;font-weight:700;">${fullName}</span>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  ${rows}
                  <tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">How can we help?</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;">
                      <div style="background:#0C1014;border:1px solid #232A32;border-radius:11px;padding:14px 16px;color:#EAECEF;font-size:15px;line-height:1.6;white-space:pre-wrap;">${message || "(no message)"}</div>
                    </td>
                  </tr>
                </table>

                ${
                  siteUrl
                    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${siteUrl}/contact" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open Contact page</a>
                    </td>
                  </tr>
                </table>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;
});

registerTemplate("contactAutoReply", ({
  firstName,
  fullName,
  email,
  company,
  phone,
  state,
  message,
  supportEmail,
  siteUrl,
}) => {
  const rows = [
    contactFieldRow("Name", fullName),
    contactFieldRow("Email", email, { topBorder: true, accent: true }),
    contactFieldRow("Company / Dealership", company, { topBorder: true }),
    contactFieldRow("Mobile number", phone, { topBorder: true }),
    contactFieldRow("State", state, { topBorder: true }),
  ].join("");

  return `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Get in touch</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:30px;line-height:1.15;color:#EAECEF;">Thanks — we'll be in touch soon!</h1>
                <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Hi ${firstName}, we received your message and our team will get back to you shortly.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <div style="display:inline-block;background:rgba(44,146,87,.13);border:1px solid rgba(44,146,87,.34);color:#46D392;font-size:13px;font-weight:700;padding:8px 12px;border-radius:999px;margin-bottom:16px;">Message received</div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                  ${rows}
                  ${
                    message
                      ? `<tr>
                    <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Your message</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px 16px;">
                      <div style="background:#0C1014;border:1px solid #232A32;border-radius:11px;padding:14px 16px;color:#EAECEF;font-size:15px;line-height:1.6;white-space:pre-wrap;">${message}</div>
                    </td>
                  </tr>`
                      : ""
                  }
                </table>

                <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Need to add anything? Reply to this email or write us at <a href="mailto:${supportEmail}" style="color:#46D392;text-decoration:none;font-weight:600;">${supportEmail}</a>.</p>

                ${
                  siteUrl
                    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${siteUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Back to AutoVault</a>
                    </td>
                  </tr>
                </table>`
                    : ""
                }

                <p style="margin:18px 0 0 0;color:#5A636D;font-size:12px;line-height:1.6;">— The AutoVault team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;
});

export function subscriptionWelcomeEmail(data) {
  return renderTemplate("subscriptionWelcome", data);
}

export function salesRepWelcomeEmail(data) {
  return renderTemplate("salesRepWelcome", data);
}

export function userInvitationEmail(data) {
  return renderTemplate("userInvitation", data);
}

export function resetPasswordEmail(data) {
  return renderTemplate("resetPassword", data);
}

export function billingUpcomingReminderEmail(data) {
  return renderTemplate("billingUpcomingReminder", data);
}

export function billingDueNoticeEmail(data) {
  return renderTemplate("billingDueNotice", data);
}

export function contactInboundEmail(data) {
  return renderTemplate("contactInbound", data);
}

export function contactAutoReplyEmail(data) {
  return renderTemplate("contactAutoReply", data);
}

registerTemplate("supportInbound", ({
  ticketId,
  submittedAt,
  dealership,
  planLabel,
  location,
  dealershipPhone,
  fromName,
  fromRole,
  fromEmail,
  fromPhone,
  topic,
  subject,
  priority,
  messageHtml,
}) => {
  const theme = supportPriorityTheme(priority);
  const rows = [
    contactFieldRow("Ticket", ticketId, { accent: true }),
    contactFieldRow("Submitted", submittedAt, { topBorder: true }),
    contactFieldRow("Dealership", dealership, { topBorder: true }),
    contactFieldRow("Plan", planLabel, { topBorder: true }),
    contactFieldRow("Location", location, { topBorder: true }),
    contactFieldRow("Dealership phone", dealershipPhone, { topBorder: true }),
    contactFieldRow("From", fromName, { topBorder: true }),
    contactFieldRow("Role", fromRole, { topBorder: true }),
    contactFieldRow("Email", fromEmail, { topBorder: true, accent: true }),
    contactFieldRow("Phone", fromPhone, { topBorder: true }),
    contactFieldRow("Topic", topic, { topBorder: true }),
    contactFieldRow("Priority", priority, { topBorder: true }),
    contactFieldRow("Subject", subject, { topBorder: true }),
  ].join("");

  const bodyHtml = `
    ${supportPriorityPill(theme)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
      ${rows}
      <tr>
        <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Message</td>
      </tr>
      <tr>
        <td style="padding:0 16px 16px 16px;">
          <div style="background:#0C1014;border:1px solid #232A32;border-left:3px solid ${theme.color};border-radius:11px;padding:14px 16px;color:#EAECEF;font-size:15px;line-height:1.65;">${messageHtml || "(no message)"}</div>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Reply to this email to reach <span style="color:#EAECEF;font-weight:700;">${fromName}</span> directly.</p>
  `;

  return wrapTransactionalEmail({
    preheader: `${priority} · ${topic} · ${subject}`,
    badge: theme.badge,
    badgeColor: theme.color,
    headerTint: theme.headerTint,
    title: subject || "New support ticket",
    introHtml: `<span style="color:#EAECEF;font-weight:700;">${fromName}</span> at <span style="color:#EAECEF;font-weight:700;">${dealership}</span> submitted a ${String(priority || "Normal").toLowerCase()} request.`,
    bodyHtml,
  });
});

registerTemplate("supportAutoReply", ({
  firstName,
  ticketId,
  submittedAt,
  dealership,
  topic,
  subject,
  priority,
  messageHtml,
  supportEmail,
  siteUrl,
}) => {
  const theme = supportPriorityTheme(priority);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const rows = [
    contactFieldRow("Ticket", ticketId, { accent: true }),
    contactFieldRow("Submitted", submittedAt, { topBorder: true }),
    contactFieldRow("Dealership", dealership, { topBorder: true }),
    contactFieldRow("Topic", topic, { topBorder: true }),
    contactFieldRow("Priority", priority, { topBorder: true }),
    contactFieldRow("Subject", subject, { topBorder: true }),
  ].join("");

  const bodyHtml = `
    <div style="display:inline-block;background:#173021;border:1px solid #2C9257;color:#46D392;font-size:13px;font-weight:700;padding:8px 12px;border-radius:999px;margin-bottom:16px;">Request received</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
      ${rows}
      ${
        messageHtml
          ? `<tr>
        <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Your message</td>
      </tr>
      <tr>
        <td style="padding:0 16px 16px 16px;">
          <div style="background:#0C1014;border:1px solid #232A32;border-left:3px solid ${theme.color};border-radius:11px;padding:14px 16px;color:#EAECEF;font-size:15px;line-height:1.65;">${messageHtml}</div>
        </td>
      </tr>`
          : ""
      }
    </table>
    <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Our team typically replies within one business day. Need to add anything? Reply to this email or write us at <a href="mailto:${supportEmail}" style="color:#46D392;text-decoration:none;font-weight:600;">${supportEmail}</a>.</p>
    ${supportCtaButton(siteUrl, "Back to AutoVault")}
    <p style="margin:18px 0 0 0;color:#5A636D;font-size:12px;line-height:1.6;">— The AutoVault team</p>
  `;

  return wrapTransactionalEmail({
    preheader: `Ticket ${ticketId} received — ${subject}`,
    badge: "Support confirmation",
    badgeColor: "#46D392",
    headerTint: "#173021",
    title: "We got your request",
    introHtml: `${greeting} ticket <span style="color:#EAECEF;font-weight:700;">${ticketId}</span> is in our queue.`,
    bodyHtml,
    footerHtml: "",
  });
});

export function supportInboundEmail(data) {
  return renderTemplate("supportInbound", data);
}

export function supportAutoReplyEmail(data) {
  return renderTemplate("supportAutoReply", data);
}
