import { env } from "../config/env.js";

export function ownerAuth(req, res, next) {
  const headerAuth = req.headers.authorization || "";
  const bearerToken = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice(7).trim()
    : "";
  const ownerKey = req.headers["x-owner-key"] || bearerToken;

  if (!ownerKey || ownerKey !== env.OWNER_API_KEY) {
    return res.status(401).json({ message: "Unauthorized owner access" });
  }
  return next();
}
