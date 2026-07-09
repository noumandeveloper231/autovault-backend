import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { Registration } from "../models/Registration.js";
import { sendEmail } from "../utils/email.js";
import { subscriptionWelcomeEmail } from "../utils/email-templates.js";
import { hashPassword, portalForPlan } from "../utils/auth.js";

function generateTemporaryPassword() {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.randomBytes(12);
  let password = "";
  for (let i = 0; i < 12; i += 1) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

function loginPathForPlan(plan) {
  const portal = portalForPlan(plan);
  if (portal === "wholesale") return "/wholesale/login";
  if (portal === "sales_rep") return "/sales-rep/login";
  return "/login";
}

async function sendWelcomeIfNeeded(registration) {
  if (registration.emailSentAt) return;
  const temporaryPassword = generateTemporaryPassword();
  registration.temporaryPasswordHash = hashPassword(temporaryPassword);
  const base = env.FRONTEND_URL.replace(/\/+$/, "");
  const loginPath = loginPathForPlan(registration.plan);
  await sendEmail({
    to: registration.email,
    subject: "Your AutoVault plan is active",
    html: subscriptionWelcomeEmail({
      name: registration.name,
      loginEmail: registration.email,
      temporaryPassword,
      dealership: registration.dealership,
      plan: registration.plan,
      monthlyFee: registration.monthlyFee,
      loginUrl: `${base}${loginPath}`,
    }),
  });
  registration.emailSentAt = new Date();
  registration.temporaryPasswordSentAt = new Date();
}

export async function handleStripeWebhook(req, res) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ message: "Stripe webhook not configured." });
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const registrationId = session?.metadata?.registrationId;
      if (registrationId) {
        const registration = await Registration.findById(registrationId);
        if (registration) {
          registration.status = "active";
          registration.paymentStatus = "on-time";
          registration.stripeCheckoutSessionId = session.id;
          registration.stripeCustomerId = String(session.customer || "");
          await sendWelcomeIfNeeded(registration);
          await registration.save();
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      const registrationId = sub?.metadata?.registrationId;
      const registration =
        (registrationId && (await Registration.findById(registrationId))) ||
        (sub.id ? await Registration.findOne({ stripeSubscriptionId: sub.id }) : null) ||
        (sub.customer ? await Registration.findOne({ stripeCustomerId: String(sub.customer) }) : null);

      if (registration) {
        registration.plan = sub?.metadata?.plan || registration.plan;
        registration.stripeCustomerId = String(sub.customer || registration.stripeCustomerId || "");
        registration.stripeSubscriptionId = sub.id;
        registration.status = sub.status === "canceled" ? "canceled" : "active";
        registration.paymentStatus = sub.status === "past_due" ? "behind" : "on-time";
        if (registration.status === "active") {
          await sendWelcomeIfNeeded(registration);
        }
        await registration.save();
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : "";
      if (subscriptionId) {
        await Registration.updateOne(
          { stripeSubscriptionId: subscriptionId },
          { $set: { status: "payment_failed", paymentStatus: "behind" } },
        );
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[stripe webhook] handler error:", error);
    return res.status(500).json({ message: "Webhook processing failed." });
  }
}
