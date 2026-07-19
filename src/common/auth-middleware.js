import { verifyAccessToken } from "./auth-utils.js";
import { unauthorized, forbidden } from "./errors.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { PLAN_HIERARCHY, planHasFeature } from "../utils/plans.js";

export function authenticate(req, _res, next) {
  const headerAuth = req.headers.authorization || "";
  const token = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice(7).trim()
    : "";
  if (!token) return next(unauthorized("Missing authorization token."));

  try {
    const claims = verifyAccessToken(token);
    req.auth = {
      userId: String(claims.sub),
      email: claims.email,
      name: claims.name,
      role: claims.role,
      dealershipId: claims.dealershipId || null,
      plan: claims.plan || null,
      portal: claims.portal,
      impersonation: !!claims.impersonation,
      impersonatedBy: claims.impersonatedBy ? String(claims.impersonatedBy) : null,
      impersonationId: claims.impersonationId || null,
      purpose: claims.purpose || null,
    };
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token."));
  }
}

/** Authenticate JWT then load the active User row onto req.user */
export function authenticateLoad(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);
    return loadUser(req, res, next);
  });
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.auth?.role) return next(unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(forbidden("You do not have permission for this action."));
    }
    return next();
  };
}

/** Require a minimum plan tier.
 *  "growing_dealership" = highest, "wholesaler" = lowest.
 *  Only dealership admin roles (owner, manager) are subject to plan checks.
 *  platform_owner bypasses plan checks.
 */
export function requirePlan(minPlan) {
  return (req, _res, next) => {
    if (req.auth?.role === "platform_owner") return next();
    const plan = req.auth?.plan;
    const minLevel = PLAN_HIERARCHY[minPlan] ?? 0;
    const userLevel = PLAN_HIERARCHY[plan] ?? -1;
    if (userLevel < minLevel) {
      return next(forbidden("Your plan does not include this feature. Please upgrade your plan."));
    }
    return next();
  };
}

/** Require an exact plan slug (e.g. wholesaler-only features). platform_owner bypasses. */
export function requireExactPlan(planSlug) {
  return (req, _res, next) => {
    if (req.auth?.role === "platform_owner") return next();
    if (req.auth?.plan !== planSlug) {
      return next(forbidden("This feature is only available on the Wholesaler plan."));
    }
    return next();
  };
}

/** Require PLAN_FEATURES[plan][feature] === true. platform_owner bypasses. */
export function requireFeature(feature) {
  return (req, _res, next) => {
    if (req.auth?.role === "platform_owner") return next();
    if (!planHasFeature(req.auth?.plan, feature)) {
      return next(forbidden("Your plan does not include this feature."));
    }
    return next();
  };
}

export function requireTenant(req, _res, next) {
  if (req.auth?.role === "platform_owner") return next();
  if (!req.auth?.dealershipId) {
    return next(forbidden("No dealership context on this account."));
  }
  return next();
}

/** Resolve dealershipId for queries � never trust client body for tenants. */
export function tenantId(req, explicitId) {
  if (req.auth?.role === "platform_owner" && explicitId) return explicitId;
  return req.auth?.dealershipId || null;
}

export function ownerOrApiKey(req, _res, next) {
  const headerAuth = req.headers.authorization || "";
  const bearerToken = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice(7).trim()
    : "";
  const ownerKey = req.headers["x-owner-key"] || "";

  if (ownerKey && ownerKey === env.OWNER_API_KEY) {
    req.auth = {
      userId: null,
      role: "platform_owner",
      portal: "owner",
      dealershipId: null,
      authType: "api_key",
    };
    return next();
  }

  if (bearerToken) {
    try {
      const claims = verifyAccessToken(bearerToken);
      if (claims.role === "platform_owner" || claims.portal === "owner") {
        req.auth = {
          userId: String(claims.sub),
          email: claims.email,
          name: claims.name,
          role: "platform_owner",
          portal: "owner",
          dealershipId: null,
          authType: "token",
        };
        return next();
      }
    } catch {
      // fall through
    }
  }
  return next(unauthorized("Unauthorized owner access"));
}

export async function loadUser(req, _res, next) {
  if (!req.auth?.userId) return next();
  const user = await prisma.user.findFirst({
    where: { id: req.auth.userId, deletedAt: null, isActive: true },
  });
  if (!user) return next(unauthorized("Session is no longer valid."));
  req.user = user;
  return next();
}

export const ADMIN_ROLES = ["owner", "manager", "platform_owner"];
export const DEALERSHIP_ADMIN_ROLES = ["owner", "manager"];
export const WRITE_ROLES = ["owner", "manager", "sales_rep", "wholesale_dealer"];
export const READ_FINANCE_ROLES = [
  "owner",
  "manager",
  "cpa",
  "platform_owner",
];
