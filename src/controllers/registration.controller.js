import { Registration } from "../models/Registration.js";
import { PLAN_SLUG_TO_LABEL } from "../utils/plans.js";
import {
  hashToken,
  verifyCompletionToken,
} from "../utils/tokens.js";
import { stripe } from "../lib/stripe.js";

export async function upsertRegistration(req, res) {
  const { name, email, phone, dealership, city, state } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedState = String(state).trim().toUpperCase();
  const normalizedCity = String(city).trim();

  const existing = await Registration.findOne({ email: normalizedEmail });
  if (existing?.status === "active") {
    return res
      .status(409)
      .json({ message: "This email already has an active subscription." });
  }

  if (existing) {
    existing.name = name.trim();
    existing.phone = (phone || "").trim();
    existing.dealership = dealership.trim();
    existing.city = normalizedCity;
    existing.state = normalizedState;
    await existing.save();
    return res.json({
      registrationId: existing.id,
      status: existing.status,
    });
  }

  const registration = await Registration.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: (phone || "").trim(),
    dealership: dealership.trim(),
    city: normalizedCity,
    state: normalizedState,
  });

  return res.status(201).json({
    registrationId: registration.id,
    status: registration.status,
  });
}

export async function completeRegistration(req, res) {
  const token = String(req.query.token || "");
  if (!token) {
    return res.status(400).json({ message: "Missing token." });
  }

  let payload;
  try {
    payload = verifyCompletionToken(token);
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  const registration = await Registration.findById(payload.registrationId);
  if (!registration) {
    return res.status(404).json({ message: "Registration not found." });
  }

  if (
    !registration.completionTokenHash ||
    registration.completionTokenHash !== hashToken(token) ||
    !registration.completionTokenExpiresAt ||
    registration.completionTokenExpiresAt.getTime() < Date.now()
  ) {
    return res.status(401).json({ message: "Token is no longer valid." });
  }

  const sessionId = payload.sessionId || registration.stripeCheckoutSessionId;
  if (registration.status !== "active" && stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      if (session.payment_status === "paid" || session.subscription) {
        registration.status = "active";
        registration.paymentStatus = "on-time";
        if (session.subscription && typeof session.subscription !== "string") {
          registration.stripeSubscriptionId = session.subscription.id;
          registration.stripeCustomerId = String(session.customer || "");
        }
      }
    } catch (error) {
      console.error("[completeRegistration] Stripe session lookup failed:", error.message);
    }
  }

  registration.completionTokenHash = null;
  registration.completionTokenExpiresAt = null;
  await registration.save();

  return res.json({
    registration: {
      id: registration.id,
      name: registration.name,
      email: registration.email,
      dealership: registration.dealership,
      plan: registration.plan,
      planLabel: PLAN_SLUG_TO_LABEL[registration.plan] || "Dealership Plan",
      status: registration.status,
      paymentStatus: registration.paymentStatus,
    },
  });
}
