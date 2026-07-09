import { PLAN_SLUG_TO_LABEL } from "./plans.js";

export function subscriptionWelcomeEmail({
  name,
  loginEmail,
  temporaryPassword,
  dealership,
  plan,
  monthlyFee,
  loginUrl,
}) {
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
}
