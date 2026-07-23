import { PLAN_SLUG_TO_LABEL } from "./plans.js";

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

registerTemplate("subscriptionWelcome", ({ name, loginEmail, temporaryPassword, dealership, plan, monthlyFee, loginUrl }) => {
  const planLabel = PLAN_SLUG_TO_LABEL[plan] || plan;
  return `
    <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                  <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                  <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Payment Confirmed</div>
                  <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:30px;line-height:1.15;color:#EAECEF;">Welcome, ${name}.</h1>
                  <p style="margin:10px 0 0 0;color:#A5AFBC;font-size:15px;line-height:1.6;">Your ${planLabel} plan is now active for <span style="color:#EAECEF;font-weight:700;">${dealership}</span>.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 28px 26px 28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1419;border:1px solid #232A32;border-radius:12px;">
                    <tr>
                      <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Login Email</td>
                    </tr>
                    <tr>
                      <td style="padding:0 16px 14px 16px;color:#EAECEF;font-size:16px;font-weight:600;">${loginEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding:16px 16px 6px 16px;color:#8B95A1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #232A32;">Temporary Password</td>
                    </tr>
                    <tr>
                      <td style="padding:0 16px 16px 16px;">
                        <div style="display:inline-block;background:#171C22;border:1px dashed #2D8D56;color:#46D392;padding:10px 14px;border-radius:10px;font-family:'JetBrains Mono',Consolas,monospace;font-size:16px;font-weight:700;">${temporaryPassword}</div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:16px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">Billing starts at <span style="color:#EAECEF;font-weight:700;">$${Number(monthlyFee).toFixed(2)}/month</span>. For security, ask your team to change this password after the first login.</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                    <tr>
                      <td style="border-radius:10px;background:#2C9257;">
                        <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open AutoVault Login</a>
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
  `;
});

registerTemplate("userInvitation", ({ role, acceptUrl }) => `
  <div style="margin:0;padding:0;background:#0A0D10;color:#EAECEF;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0D10;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#12161B;border:1px solid #232A32;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;background:linear-gradient(160deg,#12161B 40%,#173021 100%);border-bottom:1px solid #232A32;">
                <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#EAECEF;">AutoVault</div>
                <div style="margin-top:10px;color:#46D392;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Team Invitation</div>
                <h1 style="margin:14px 0 0 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#EAECEF;">You've been invited.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <p style="margin:0 0 12px 0;color:#A5AFBC;font-size:15px;line-height:1.6;">You have been invited to join AutoVault360 as <strong style="color:#EAECEF;">${role.replace("_", " ")}</strong>.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="border-radius:10px;background:#2C9257;">
                      <a href="${acceptUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Accept Invitation</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0 0;color:#8B95A1;font-size:13px;line-height:1.6;">This link expires in 7 days.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`);

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
                      <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open Sales Rep Login</a>
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

export function subscriptionWelcomeEmail(data) {
  return renderTemplate("subscriptionWelcome", data);
}

export function salesRepWelcomeEmail(data) {
  return renderTemplate("salesRepWelcome", data);
}

export function billingUpcomingReminderEmail(data) {
  return renderTemplate("billingUpcomingReminder", data);
}

export function billingDueNoticeEmail(data) {
  return renderTemplate("billingDueNotice", data);
}
