import { prisma } from "../../lib/prisma.js";
import {
  hashPassword,
  hashToken,
  randomToken,
} from "../../common/auth-utils.js";
import { notFound, forbidden, conflict } from "../../common/errors.js";
import { writeAuditLog } from "../../common/audit.js";
import { pageMeta } from "../../common/validate.js";
import { env } from "../../config/env.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_ROLES = ["owner", "manager"];

async function assertAllowedRoleForPlan(dealershipId, role) {
  const dealership = await prisma.dealership.findUnique({ where: { id: dealershipId } });
  if (!dealership) return;

  if (dealership.plan === "independent_dealer") {
    if (role === "sales_rep") {
      throw forbidden(
        "Your Independent Dealers plan does not include sales representatives. Upgrade to the Growing Dealerships plan to add sales reps.",
      );
    }
    if (ADMIN_ROLES.includes(role)) {
      const existingAdmins = await prisma.user.count({
        where: { dealershipId, role: { in: ADMIN_ROLES }, deletedAt: null },
      });
      if (existingAdmins >= 1) {
        throw forbidden(
          "Your Independent Dealers plan only allows 1 admin account. Upgrade to the Growing Dealerships plan to add more.",
        );
      }
    }
  }
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    imageUrl: user.imageUrl,
    role: user.role,
    isActive: user.isActive,
    dealershipId: user.dealershipId,
    lastLoginAt: user.lastLoginAt,
    mustResetPassword: user.mustResetPassword,
    introCompleted: user.introCompleted,
    termsAccepted: user.termsAccepted,
    termsVersion: user.termsVersion || null,
    termsAcceptedAt: user.termsAcceptedAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeInvitation(invitation) {
  if (!invitation) return null;
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    fullName: invitation.fullName,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    invitedById: invitation.invitedById,
    createdAt: invitation.createdAt,
  };
}

function assertManageableRole(role) {
  if (role === "platform_owner") {
    throw forbidden("Cannot assign or invite platform_owner role.");
  }
}

async function findTenantUser(id, dealershipId) {
  const user = await prisma.user.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!user) throw notFound("User not found.");
  return user;
}

export async function listUsers(dealershipId, query) {
  const { page, limit, q, role, isActive } = query;
  const where = { dealershipId, deletedAt: null };
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    users: rows.map(serializeUser),
    meta: pageMeta(total, page, limit),
  };
}

export async function createUser(dealershipId, data, changedById, ipAddress) {
  assertManageableRole(data.role);
  await assertAllowedRoleForPlan(dealershipId, data.role);

  const existing = await prisma.user.findFirst({
    where: { dealershipId, email: data.email, deletedAt: null },
  });
  if (existing) throw conflict("A user with this email already exists.");

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone ?? null,
      imageUrl: data.imageUrl ?? null,
      role: data.role,
      dealershipId,
    },
  });

  await writeAuditLog({
    dealershipId,
    changedById,
    entityType: "User",
    entityId: user.id,
    action: "create",
    newValues: serializeUser(user),
    ipAddress,
  });

  return serializeUser(user);
}

export async function updateUser(
  dealershipId,
  userId,
  data,
  changedById,
  ipAddress,
) {
  const existing = await findTenantUser(userId, dealershipId);
  if (existing.role === "platform_owner") {
    throw forbidden("Cannot modify platform_owner accounts.");
  }
  if (data.role) assertManageableRole(data.role);

  const updateData = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  await writeAuditLog({
    dealershipId,
    changedById,
    entityType: "User",
    entityId: userId,
    action: "update",
    oldValues: serializeUser(existing),
    newValues: serializeUser(updated),
    ipAddress,
  });

  return serializeUser(updated);
}

export async function deactivateUser(
  dealershipId,
  userId,
  changedById,
  ipAddress,
) {
  const existing = await findTenantUser(userId, dealershipId);
  if (existing.role === "platform_owner") {
    throw forbidden("Cannot deactivate platform_owner accounts.");
  }
  if (existing.id === changedById) {
    throw forbidden("You cannot deactivate your own account.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, deletedAt: new Date() },
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    dealershipId,
    changedById,
    entityType: "User",
    entityId: userId,
    action: "deactivate",
    oldValues: serializeUser(existing),
    newValues: serializeUser(updated),
    ipAddress,
  });

  return serializeUser(updated);
}

export async function inviteUser(
  dealershipId,
  data,
  invitedById,
  ipAddress,
) {
  assertManageableRole(data.role);
  await assertAllowedRoleForPlan(dealershipId, data.role);

  const existingUser = await prisma.user.findFirst({
    where: { dealershipId, email: data.email, deletedAt: null },
  });
  if (existingUser) throw conflict("A user with this email already exists.");

  const pendingInvite = await prisma.invitation.findFirst({
    where: {
      dealershipId,
      email: data.email,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (pendingInvite) {
    throw conflict("A pending invitation already exists for this email.");
  }

  const rawToken = randomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invitation = await prisma.invitation.create({
    data: {
      dealershipId,
      email: data.email,
      role: data.role,
      fullName: data.fullName ?? null,
      tokenHash,
      expiresAt,
      invitedById,
    },
  });

  const base = env.FRONTEND_URL.replace(/\/+$/, "");
  const acceptUrl = `${base}/accept-invitation?token=${encodeURIComponent(rawToken)}`;

  try {
    const { sendEmail } = await import("../../utils/email.js");
    await sendEmail({
      to: data.email,
      subject: "You're invited to AutoVault360",
      html: `<p>You have been invited to join AutoVault360 as <strong>${data.role.replace("_", " ")}</strong>.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    });
  } catch {
    // Email failure should not block invitation record
  }

  await writeAuditLog({
    dealershipId,
    changedById: invitedById,
    entityType: "Invitation",
    entityId: invitation.id,
    action: "invite",
    newValues: { email: data.email, role: data.role },
    ipAddress,
  });

  return serializeInvitation(invitation);
}

export async function acceptInvitation(data, ipAddress) {
  const tokenHash = hashToken(data.token);
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash },
    include: { dealership: true },
  });

  if (!invitation || invitation.status !== "pending") {
    throw notFound("Invalid or expired invitation.");
  }
  if (invitation.expiresAt <= new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "expired" },
    });
    throw notFound("Invalid or expired invitation.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      dealershipId: invitation.dealershipId,
      email: invitation.email,
      deletedAt: null,
    },
  });
  if (existingUser) throw conflict("An account with this email already exists.");

  const passwordHash = await hashPassword(data.password);
  const fullName = data.fullName || invitation.fullName || invitation.email;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        fullName,
        role: invitation.role,
        dealershipId: invitation.dealershipId,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    return created;
  });

  await writeAuditLog({
    dealershipId: invitation.dealershipId,
    changedById: user.id,
    entityType: "Invitation",
    entityId: invitation.id,
    action: "accept",
    newValues: { userId: user.id },
    ipAddress,
  });

  return serializeUser(user);
}

export async function listInvitations(dealershipId, query) {
  const { page, limit, status } = query;
  const where = { dealershipId };
  if (status) where.status = status;

  const [total, rows] = await Promise.all([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    invitations: rows.map(serializeInvitation),
    meta: pageMeta(total, page, limit),
  };
}
