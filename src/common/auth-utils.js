import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  // Legacy SHA-256 support during migration from Mongo temp passwords
  if (hash.length === 64 && !hash.startsWith("$2")) {
    const legacy = crypto.createHash("sha256").update(String(password || "")).digest("hex");
    return legacy === hash;
  }
  return bcrypt.compare(String(password), hash);
}

export function portalForPlan(plan) {
  if (plan === "wholesaler") return "wholesale";
  if (plan === "independent_dealer") return "admin";
  return "admin";
}

export function roleForPlan(plan) {
  if (plan === "wholesaler") return "wholesale_dealer";
  if (plan === "independent_dealer") return "owner";
  return "owner";
}

export function dashboardPathForPortal(portal) {
  if (portal === "wholesale") return "/wholesale/dashboard";
  if (portal === "sales_rep") return "/sales-rep/dashboard";
  if (portal === "owner") return "/owner/dashboard";
  if (portal === "cpa") return "/cpa/dashboard";
  return "/dashboard";
}

export function loginPathForPortal(portal) {
  if (portal === "wholesale") return "/wholesale/login";
  if (portal === "sales_rep") return "/sales-rep/login";
  if (portal === "owner") return "/owner/login";
  if (portal === "cpa") return "/cpa/login";
  return "/login";
}

export function portalForRole(role) {
  if (role === "platform_owner") return "owner";
  if (role === "wholesale_dealer") return "wholesale";
  if (role === "sales_rep") return "sales_rep";
  if (role === "cpa") return "cpa";
  if (role === "owner" || role === "manager") return "admin";
  return "admin";
}

export function signAccessToken(user) {
  const portal = portalForRole(user.role);
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      dealershipId: user.dealershipId || null,
      plan: user.dealership?.plan || null,
      portal,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES },
  );
}

/** Short-lived access token for admin → sales_rep support sessions. No refresh token. */
export function signImpersonationAccessToken(admin, targetUser, opts = {}) {
  const impersonationId = opts.impersonationId || crypto.randomUUID();
  const purpose = String(opts.purpose || "support").slice(0, 200);
  const expiresIn = opts.expiresIn || env.JWT_IMPERSONATION_EXPIRES || "15m";
  const token = jwt.sign(
    {
      sub: targetUser.id,
      email: targetUser.email,
      name: targetUser.fullName,
      role: "sales_rep",
      dealershipId: targetUser.dealershipId || null,
      plan: targetUser.dealership?.plan || admin.plan || null,
      portal: "sales_rep",
      type: "access",
      impersonation: true,
      impersonatedBy: admin.userId,
      impersonationId,
      purpose,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn },
  );
  return { token, impersonationId, purpose, expiresIn };
}

export function signRefreshToken(user, jti) {
  return jwt.sign(
    {
      sub: user.id,
      jti,
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES },
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type && payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return payload;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function generateTemporaryPassword() {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.randomBytes(12);
  let password = "";
  for (let i = 0; i < 12; i += 1) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
