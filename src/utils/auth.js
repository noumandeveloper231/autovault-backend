import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function hashPassword(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export function portalForPlan(plan) {
  if (plan === "wholesaler") return "wholesale";
  if (plan === "independent_dealer") return "sales_rep";
  return "admin";
}

export function signAuthToken(registration) {
  return jwt.sign(
    {
      sub: String(registration.id),
      plan: registration.plan,
      portal: portalForPlan(registration.plan),
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
