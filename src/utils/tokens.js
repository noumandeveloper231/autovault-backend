import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function createCompletionToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyCompletionToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
