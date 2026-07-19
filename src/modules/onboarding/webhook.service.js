import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma.js";
import { stripe } from "../../lib/stripe.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import { subscriptionWelcomeEmail } from "../../utils/email-templates.js";
import { portalForPlan, hashPassword, generateTemporaryPassword } from "../../common/auth-utils.js";
import { PLAN_SLUG_TO_LABEL } from "../../utils/plans.js";
import { activateFromRegistration } from "../dealerships/dealership.service.js";
import { logger } from "../../common/logger.js";

function loginPathForPlan(plan) {
  const portal = portalForPlan(plan);
  if (portal === "wholesale") return "/wholesale/login";
  if (portal === "sales_rep") return "/sales-rep/login";
  return "/login";
}

async function sendWelcomeIfNeeded(registrationId) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });
  if (!registration || registration.emailSentAt) return;

  const lockId = randomUUID();
  const locked = await prisma.registration.updateMany({
    where: {
      id: registrationId,
      emailSentAt: null,
      welcomeEmailLockId: null,
    },
    data: { welcomeEmailLockId: lockId },
  });
  if (!locked.count) return;

  let temporaryPassword = null;
  let reg = registration;

  try {
    if (!reg.dealershipId) {
      const activated = await activateFromRegistration(reg);
      reg = await prisma.registration.findUnique({ where: { id: registrationId } });
      temporaryPassword = activated.temporaryPassword;
    } else if (!reg.temporaryPasswordHash) {
      temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await prisma.user.updateMany({
        where: { email: reg.email, dealershipId: reg.dealershipId },
        data: { passwordHash, mustResetPassword: true },
      });
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          temporaryPasswordHash: passwordHash,
          temporaryPasswordSentAt: new Date(),
        },
      });
    }

    if (!temporaryPassword) {
      reg = await prisma.registration.findUnique({ where: { id: registrationId } });
      await prisma.registration.updateMany({
        where: { id: registrationId, welcomeEmailLockId: lockId },
        data: { welcomeEmailLockId: null },
      });
      return;
    }

    const base = env.FRONTEND_URL.replace(/\/+$/, "");
    const loginPath = loginPathForPlan(reg.plan);

    await sendEmail({
      to: reg.email,
      subject: "Your AutoVault plan is active",
      html: subscriptionWelcomeEmail({
        name: reg.name,
        loginEmail: reg.email,
        temporaryPassword,
        dealership: reg.dealershipName,
        plan: PLAN_SLUG_TO_LABEL[reg.plan] || reg.plan,
        monthlyFee: reg.monthlyFee,
        loginUrl: `${base}${loginPath}`,
      }),
    });

    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        emailSentAt: new Date(),
        temporaryPasswordSentAt: new Date(),
        welcomeEmailLockId: null,
      },
    });
  } catch (error) {
    await prisma.registration.updateMany({
      where: { id: registrationId, welcomeEmailLockId: lockId },
      data: { welcomeEmailLockId: null },
    });
    throw error;
  }
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook not configured.");
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const registrationId = session?.metadata?.registrationId;
    if (registrationId) {
      await prisma.registration.updateMany({
        where: { id: registrationId },
        data: {
          status: "active",
          paymentStatus: "on_time",
          stripeCheckoutSessionId: session.id,
          stripeCustomerId: String(session.customer || ""),
          plan: session.metadata?.plan || undefined,
        },
      });
      await sendWelcomeIfNeeded(registrationId);
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const registrationId = sub?.metadata?.registrationId;

    let registration =
      (registrationId &&
        (await prisma.registration.findUnique({ where: { id: registrationId } }))) ||
      (sub.id &&
        (await prisma.registration.findFirst({
          where: { stripeSubscriptionId: sub.id },
        }))) ||
      (sub.customer &&
        (await prisma.registration.findFirst({
          where: { stripeCustomerId: String(sub.customer) },
        })));

    if (registration) {
      const status = sub.status === "canceled" ? "canceled" : "active";
      const paymentStatus = sub.status === "past_due" ? "behind" : "on_time";

      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          plan: sub.metadata?.plan || registration.plan,
          stripeCustomerId: String(sub.customer || registration.stripeCustomerId || ""),
          stripeSubscriptionId: sub.id,
          status,
          paymentStatus,
        },
      });

      if (status === "active") {
        await sendWelcomeIfNeeded(registration.id);
      }

      if (registration.dealershipId) {
        await prisma.dealership.update({
          where: { id: registration.dealershipId },
          data: {
            status: status === "canceled" ? "canceled" : "active",
            paymentStatus,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: String(sub.customer || ""),
          },
        });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subscriptionId =
      typeof invoice.subscription === "string" ? invoice.subscription : "";
    if (subscriptionId) {
      const reg = await prisma.registration.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (reg) {
        await prisma.registration.update({
          where: { id: reg.id },
          data: { status: "payment_failed", paymentStatus: "behind" },
        });
        if (reg.dealershipId) {
          await prisma.dealership.update({
            where: { id: reg.dealershipId },
            data: { status: "payment_failed", paymentStatus: "behind" },
          });
        }
      }
    }
  }

  logger.info({ type: event.type }, "[stripe webhook] processed");
  return { received: true };
}
