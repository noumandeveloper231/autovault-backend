import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 3000),
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",
  JWT_IMPERSONATION_EXPIRES: process.env.JWT_IMPERSONATION_EXPIRES || "15m",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5500",
  OWNER_API_KEY: process.env.OWNER_API_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_WHOLESALER_PRICE_ID: process.env.STRIPE_WHOLESALER_PRICE_ID || "",
  STRIPE_INDEPENDENT_DEALER_PRICE_ID:
    process.env.STRIPE_INDEPENDENT_DEALER_PRICE_ID || "",
  STRIPE_GROWING_DEALERSHIP_PRICE_ID:
    process.env.STRIPE_GROWING_DEALERSHIP_PRICE_ID || "",
  BREVO_API_KEY: process.env.BREVO_API_KEY || "",
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || "onboarding@noumandevs.online",
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || "AutoVault",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",

  // Cloudflare R2 (primary file storage)
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_BUCKET: process.env.R2_BUCKET || "",
  R2_ENDPOINT: process.env.R2_ENDPOINT || "",
  R2_REGION: process.env.R2_REGION || "auto",
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || "",
};

export function assertRequiredEnv() {
  const missing = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 16) {
    missing.push("JWT_ACCESS_SECRET (or JWT_SECRET)");
  }
  if (!env.OWNER_API_KEY) missing.push("OWNER_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
