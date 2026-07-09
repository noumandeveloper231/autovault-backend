import { Registration } from "../models/Registration.js";
import { hashPassword, portalForPlan, signAuthToken } from "../utils/auth.js";

function normalizePortal(input) {
  const value = String(input || "").trim().toLowerCase();
  if (value === "sales-rep") return "sales_rep";
  if (value === "sales_rep") return "sales_rep";
  if (value === "wholesale") return "wholesale";
  return "admin";
}

function dashboardPathForPortal(portal) {
  if (portal === "wholesale") return "/wholesale/dashboard";
  if (portal === "sales_rep") return "/sales-rep/dashbaord";
  return "/dashboard";
}

function loginPathForPortal(portal) {
  if (portal === "wholesale") return "/wholesale/login";
  if (portal === "sales_rep") return "/sales-rep/login";
  return "/login";
}

export async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const requestedPortal = normalizePortal(req.body.portal);

  const registration = await Registration.findOne({ email });
  if (!registration) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  if (registration.status !== "active") {
    return res
      .status(403)
      .json({ message: "Your plan is not active yet. Complete checkout first." });
  }

  const expectedHash = registration.temporaryPasswordHash || "";
  if (!expectedHash || expectedHash !== hashPassword(password)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const allowedPortal = portalForPlan(registration.plan);
  if (requestedPortal !== allowedPortal) {
    return res.status(403).json({
      message: `Your plan can only access the ${allowedPortal.replace("_", " ")} portal.`,
      allowedPortal,
      redirectLoginPath: loginPathForPortal(allowedPortal),
      redirectDashboardPath: dashboardPathForPortal(allowedPortal),
    });
  }

  const token = signAuthToken(registration);
  return res.json({
    token,
    user: {
      id: registration.id,
      name: registration.name,
      email: registration.email,
      dealership: registration.dealership,
      city: registration.city,
      state: registration.state,
      plan: registration.plan,
      portal: allowedPortal,
    },
    redirectDashboardPath: dashboardPathForPortal(allowedPortal),
  });
}

export async function me(req, res) {
  const registration = await Registration.findById(req.auth.sub).lean();
  if (!registration || registration.status !== "active") {
    return res.status(401).json({ message: "Session is no longer valid." });
  }

  const allowedPortal = portalForPlan(registration.plan);
  return res.json({
    user: {
      id: String(registration._id),
      name: registration.name,
      email: registration.email,
      dealership: registration.dealership,
      city: registration.city,
      state: registration.state,
      plan: registration.plan,
      portal: allowedPortal,
    },
    redirectLoginPath: loginPathForPortal(allowedPortal),
    redirectDashboardPath: dashboardPathForPortal(allowedPortal),
  });
}
