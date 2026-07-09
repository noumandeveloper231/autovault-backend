import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 3000),
  MONGODB_URI: process.env.MONGODB_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5500",
  OWNER_API_KEY: process.env.OWNER_API_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_WHOLESALER_PRICE_ID: process.env.STRIPE_WHOLESALER_PRICE_ID || "",
  STRIPE_INDEPENDENT_DEALER_PRICE_ID:
    process.env.STRIPE_INDEPENDENT_DEALER_PRICE_ID || "",
  STRIPE_GROWING_DEALERSHIP_PRICE_ID:
    process.env.STRIPE_GROWING_DEALERSHIP_PRICE_ID || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  FROM_EMAIL: process.env.FROM_EMAIL || "onboarding@resend.dev",
  FROM_NAME: process.env.FROM_NAME || "AutoVault",
};

export function assertRequiredEnv() {
  const missing = [];
  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) missing.push("JWT_SECRET");
  if (!env.OWNER_API_KEY) missing.push("OWNER_API_KEY");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
