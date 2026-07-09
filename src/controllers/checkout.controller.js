import { Registration } from "../models/Registration.js";
import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { createCompletionToken, hashToken } from "../utils/tokens.js";

const planPriceMap = {
  wholesaler: env.STRIPE_WHOLESALER_PRICE_ID,
  independent_dealer: env.STRIPE_INDEPENDENT_DEALER_PRICE_ID,
  growing_dealership: env.STRIPE_GROWING_DEALERSHIP_PRICE_ID,
};

const FRONTEND_BASE = env.FRONTEND_URL.replace(/\/+$/, "");

export async function createCheckout(req, res) {
  if (!stripe) {
    return res.status(500).json({ message: "Stripe is not configured." });
  }

  const { registrationId, plan } = req.body;
  const registration = await Registration.findById(registrationId);
  if (!registration) {
    return res.status(404).json({ message: "Registration not found." });
  }
  if (registration.status === "active") {
    return res.status(409).json({ message: "Registration is already active." });
  }

  const priceId = planPriceMap[plan];
  if (!priceId || !priceId.startsWith("price_")) {
    return res.status(500).json({ message: `Missing Stripe price for plan: ${plan}` });
  }

  let customerId = registration.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: registration.email,
      name: registration.name,
      metadata: { registrationId: registration.id },
    });
    customerId = customer.id;
    registration.stripeCustomerId = customer.id;
  }

  const token = createCompletionToken({
    registrationId: registration.id,
    plan,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        registrationId: registration.id,
        plan,
      },
    },
    metadata: {
      registrationId: registration.id,
      plan,
      completionToken: token,
    },
    success_url: `${FRONTEND_BASE}/thank-you?token=${encodeURIComponent(token)}`,
    cancel_url: `${FRONTEND_BASE}/?checkout=cancel`,
  });

  registration.plan = plan;
  registration.status = "checkout_started";
  registration.stripeCheckoutSessionId = session.id;
  registration.completionTokenHash = hashToken(token);
  registration.completionTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await registration.save();

  return res.json({
    url: session.url,
  });
}
