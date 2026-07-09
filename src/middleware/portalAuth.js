import { verifyAuthToken } from "../utils/auth.js";

export function portalAuth(req, res, next) {
  const headerAuth = req.headers.authorization || "";
  const token = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({ message: "Missing authorization token." });
  }

  try {
    req.auth = verifyAuthToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
