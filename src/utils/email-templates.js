import { PLAN_SLUG_TO_LABEL } from "./plans.js";

export function subscriptionWelcomeEmail({
  name,
  dealership,
  plan,
  monthlyFee,
  loginUrl,
}) {
  const planLabel = PLAN_SLUG_TO_LABEL[plan] || plan;
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin-bottom:8px;">Welcome to AutoVault, ${name}.</h2>
      <p>Your ${planLabel} plan is active for <b>${dealership}</b>.</p>
      <p>Billing starts at <b>$${Number(monthlyFee).toFixed(2)}/month</b>.</p>
      <p>You can now access your dashboard and start tracking your dealership operations.</p>
      <p><a href="${loginUrl}" style="color:#2C9257;font-weight:700;">Open AutoVault Login</a></p>
    </div>
  `;
}
