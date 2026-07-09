import { env } from "../config/env.js";
import jwt from "jsonwebtoken";

export function ownerAuth(req, res, next) {
  const headerAuth = req.headers.authorization || "";
  const bearerToken = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice(7).trim()
    : "";
  const ownerKey = req.headers["x-owner-key"] || bearerToken;

  if (ownerKey && ownerKey === env.OWNER_API_KEY) {
    req.ownerAuth = { authType: "api_key", role: "super_owner" };
    return next();
  }

  if (bearerToken) {
    try {
      const claims = jwt.verify(bearerToken, env.JWT_SECRET);
      if (claims?.portal === "owner" && claims?.role === "super_owner" && claims?.sub) {
        req.ownerAuth = {
          authType: "token",
          role: "super_owner",
          ownerId: String(claims.sub),
          email: String(claims.email || ""),
        };
        return next();
      }
    } catch {
      // fall through to unauthorized response
    }
  }
  return res.status(401).json({ message: "Unauthorized owner access" });
}
