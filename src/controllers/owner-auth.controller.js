import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { SuperOwner } from "../models/SuperOwner.js";
import { hashPassword } from "../utils/auth.js";

function signOwnerToken(owner) {
  return jwt.sign(
    {
      sub: String(owner.id),
      email: owner.email,
      name: owner.name || "Super Owner",
      portal: "owner",
      role: "super_owner",
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export async function ownerLogin(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const owner = await SuperOwner.findOne({ email });
  if (!owner || !owner.isActive) {
    return res.status(401).json({ message: "Invalid owner credentials." });
  }
  if (owner.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ message: "Invalid owner credentials." });
  }
  owner.lastLoginAt = new Date();
  await owner.save();

  const token = signOwnerToken(owner);
  return res.json({
    token,
    user: {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      portal: "owner",
      role: "super_owner",
    },
    redirectDashboardPath: "/owner/dashboard",
  });
}

export async function ownerMe(req, res) {
  if (!req.ownerAuth?.ownerId) {
    return res.status(401).json({ message: "Session invalid." });
  }
  const owner = await SuperOwner.findById(req.ownerAuth.ownerId).lean();
  if (!owner || !owner.isActive) {
    return res.status(401).json({ message: "Session invalid." });
  }
  return res.json({
    user: {
      id: String(owner._id),
      email: owner.email,
      name: owner.name || "Super Owner",
      portal: "owner",
      role: "super_owner",
    },
    redirectLoginPath: "/owner/login",
    redirectDashboardPath: "/owner/dashboard",
  });
}
