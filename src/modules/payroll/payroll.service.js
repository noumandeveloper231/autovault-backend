import { prisma } from "../../lib/prisma.js";
import {
  hashPassword,
  generateTemporaryPassword,
  signImpersonationAccessToken,
  dashboardPathForPortal,
} from "../../common/auth-utils.js";
import { notFound, conflict, forbidden } from "../../common/errors.js";
import { writeAuditLog } from "../../common/audit.js";
import { toNum } from "../../common/serialize.js";
import { pageMeta } from "../../common/validate.js";
import { compressDataUrl } from "../../utils/image-compress.js";
import { sendEmail } from "../../utils/email.js";
import { salesRepWelcomeEmail } from "../../utils/email-templates.js";
import { env } from "../../config/env.js";

function serializeSalesRep(user, profile) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    phone: user.phone,
    isActive: user.isActive,
    role: user.role,
    profile: profile
      ? {
          id: profile.id,
          birthDate: profile.birthDate,
          baseSalary: toNum(profile.baseSalary),
          payFrequency: profile.payFrequency,
          payDay: profile.payDay,
          paymentMethod: profile.paymentMethod,
          payDocUrl: profile.payDocUrl,
          commissionRate: toNum(profile.commissionRate),
        }
      : null,
    createdAt: user.createdAt,
  };
}

function serializeStaff(s) {
  return {
    id: s.id,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    title: s.title,
    payType: s.payType,
    payRate: toNum(s.payRate),
    hireDate: s.hireDate,
    payMethod: s.payMethod,
    payDocUrl: s.payDocUrl,
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function serializeCommission(c) {
  return {
    id: c.id,
    salesRepId: c.salesRepId,
    dealJacketId: c.dealJacketId,
    commissionAmount: toNum(c.commissionAmount),
    grossProfit: toNum(c.grossProfit),
    soldPrice: toNum(c.soldPrice),
    commissionRate: toNum(c.commissionRate),
    status: c.status,
    paidAt: c.paidAt,
    paidById: c.paidById,
    createdAt: c.createdAt,
    salesRep: c.salesRep
      ? { id: c.salesRep.id, fullName: c.salesRep.fullName }
      : undefined,
    dealJacket: c.dealJacket
      ? {
          id: c.dealJacket.id,
          jacketNumber: c.dealJacket.jacketNumber,
        }
      : undefined,
  };
}

function serializePayrollRun(run) {
  return {
    id: run.id,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    status: run.status,
    totalAmount: toNum(run.totalAmount),
    notes: run.notes,
    processedAt: run.processedAt,
    createdAt: run.createdAt,
    items: run.items?.map((item) => ({
      id: item.id,
      staffMemberId: item.staffMemberId,
      salesRepId: item.salesRepId,
      description: item.description,
      amount: toNum(item.amount),
      proofPath: item.proofPath,
      staffMember: item.staffMember
        ? { id: item.staffMember.id, fullName: item.staffMember.fullName }
        : undefined,
    })),
  };
}

// --- Sales reps ---

export async function listSalesReps(dealershipId, query) {
  const { page, limit, q } = query;
  const where = {
    dealershipId,
    role: "sales_rep",
    deletedAt: null,
  };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { salesRepProfile: true },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    salesReps: users.map((u) => serializeSalesRep(u, u.salesRepProfile)),
    meta: pageMeta(total, page, limit),
  };
}

export async function createSalesRep(dealershipId, payload, ctx) {
  const existing = await prisma.user.findFirst({
    where: { dealershipId, email: payload.email, deletedAt: null },
  });
  if (existing) throw conflict("A user with this email already exists.");

  const password = payload.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: payload.email.trim().toLowerCase(),
        username: payload.username ?? null,
        passwordHash,
        fullName: payload.fullName.trim(),
        phone: payload.phone ?? null,
        role: "sales_rep",
        dealershipId,
        mustResetPassword: !payload.password,
      },
    });

    const profile = await tx.salesRepProfile.create({
      data: {
        userId: user.id,
        dealershipId,
        birthDate: payload.birthDate ?? null,
        baseSalary: payload.baseSalary ?? 0,
        payFrequency: payload.payFrequency ?? null,
        payDay: payload.payDay ?? null,
        paymentMethod: payload.paymentMethod ?? null,
        payDocUrl: payload.payDocUrl ?? null,
        commissionRate: payload.commissionRate ?? 0.1,
      },
    });

    return { user, profile };
  }, { timeout: 30000 });

  await writeAuditLog({
    dealershipId,
    changedById: ctx.userId,
    entityType: "SalesRep",
    entityId: result.user.id,
    action: "create",
    ipAddress: ctx.ipAddress,
  });

  const salesRep = serializeSalesRep(result.user, result.profile);

  if (payload.sendInvite !== false) {
    try {
      await sendRepInviteEmail(result.user, password, dealershipId);
    } catch (emailErr) {
      console.error("[createSalesRep] Failed to send invite email:", emailErr);
    }
  }

  return {
    salesRep,
    temporaryPassword: payload.password ? undefined : password,
    inviteSent: payload.sendInvite !== false,
  };
}

async function sendRepInviteEmail(user, temporaryPassword, dealershipId) {
  const dealership = await prisma.dealership.findUnique({
    where: { id: dealershipId },
    select: { name: true },
  });

  const base = env.FRONTEND_URL.replace(/\/+$/, "");
  const loginUrl = `${base}/login?portal=sales_rep`;

  await sendEmail({
    to: user.email,
    subject: `Welcome to AutoVault — ${user.fullName}`,
    html: salesRepWelcomeEmail({
      name: user.fullName,
      username: user.username || user.email,
      loginEmail: user.email,
      temporaryPassword,
      dealership: dealership?.name ?? "Your Dealership",
      loginUrl,
    }),
  });
}

export async function sendRepInvite(repId, dealershipId) {
  const user = await prisma.user.findFirst({
    where: { id: repId, dealershipId, role: "sales_rep", deletedAt: null },
  });
  if (!user) throw notFound("Sales rep not found.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustResetPassword: true },
  });

  await sendRepInviteEmail(user, temporaryPassword, dealershipId);

  return { message: "Invite sent", email: user.email };
}

/**
 * Admin support login: issue a short-lived sales_rep access token for the target
 * without revealing or using their password. No refresh token is issued.
 */
export async function impersonateSalesRep(repId, dealershipId, ctx, opts = {}) {
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    throw forbidden("Only dealership admins can view as a sales rep.");
  }

  // Never allow nested impersonation (impersonation token acting as admin)
  if (ctx.impersonation) {
    throw forbidden("Cannot start a support session while already viewing as another user.");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: repId,
      dealershipId,
      role: "sales_rep",
      deletedAt: null,
    },
    include: {
      salesRepProfile: true,
      dealership: { select: { id: true, plan: true, name: true } },
    },
  });
  if (!user) throw notFound("Sales rep not found.");
  if (!user.isActive) throw forbidden("This sales rep account is inactive.");
  if (user.role !== "sales_rep") {
    throw forbidden("You can only open a support session for sales reps.");
  }
  if (user.dealershipId !== dealershipId) {
    throw forbidden("Sales rep is outside your dealership.");
  }

  const { token, impersonationId, purpose, expiresIn } =
    signImpersonationAccessToken(
      { userId: ctx.userId, plan: ctx.plan },
      user,
      { purpose: opts.purpose || "support" },
    );

  const expiresAt = new Date(Date.now() + parseExpiresMs(expiresIn)).toISOString();

  await writeAuditLog({
    dealershipId,
    changedById: ctx.userId,
    entityType: "User",
    entityId: user.id,
    action: "impersonate",
    newValues: {
      adminId: ctx.userId,
      targetUserId: user.id,
      targetEmail: user.email,
      purpose,
      impersonationId,
      expiresAt,
    },
    ipAddress: ctx.ipAddress,
  });

  return {
    token,
    expiresIn,
    expiresAt,
    refreshToken: null,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: "sales_rep",
      portal: "sales_rep",
      dealershipId: user.dealershipId,
    },
    redirectDashboardPath: dashboardPathForPortal("sales_rep"),
    impersonation: {
      id: impersonationId,
      purpose,
      expiresAt,
      targetName: user.fullName,
      targetEmail: user.email,
      adminId: ctx.userId,
    },
  };
}

function parseExpiresMs(value) {
  const raw = String(value || "15m").trim();
  const m = raw.match(/^(\d+)(s|m|h|d)?$/i);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = (m[2] || "m").toLowerCase();
  if (unit === "s") return n * 1000;
  if (unit === "h") return n * 60 * 60 * 1000;
  if (unit === "d") return n * 24 * 60 * 60 * 1000;
  return n * 60 * 1000;
}

export async function updateSalesRep(id, dealershipId, payload, ctx) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      dealershipId,
      role: "sales_rep",
      deletedAt: null,
    },
    include: { salesRepProfile: true },
  });
  if (!user) throw notFound("Sales rep not found.");

  if (payload.payDocUrl && payload.payDocUrl.startsWith("data:image")) {
    const { dataUrl } = await compressDataUrl(payload.payDocUrl, { maxBytes: 50 * 1024, maxDimension: 1000 });
    payload = { ...payload, payDocUrl: dataUrl };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: {
        ...(payload.username !== undefined && { username: payload.username }),
        ...(payload.fullName != null && { fullName: payload.fullName.trim() }),
        ...(payload.phone !== undefined && { phone: payload.phone }),
        ...(payload.isActive != null && { isActive: payload.isActive }),
      },
    });

    let profile = user.salesRepProfile;
    if (profile) {
      profile = await tx.salesRepProfile.update({
        where: { id: profile.id },
        data: {
          ...(payload.birthDate !== undefined && { birthDate: payload.birthDate }),
          ...(payload.baseSalary != null && { baseSalary: payload.baseSalary }),
          ...(payload.payFrequency !== undefined && { payFrequency: payload.payFrequency }),
          ...(payload.payDay !== undefined && { payDay: payload.payDay }),
          ...(payload.paymentMethod !== undefined && { paymentMethod: payload.paymentMethod }),
          ...(payload.payDocUrl !== undefined && { payDocUrl: payload.payDocUrl }),
          ...(payload.commissionRate != null && {
            commissionRate: payload.commissionRate,
          }),
        },
      });
    }

    return { user: u, profile };
  }, { timeout: 30000 });

  return serializeSalesRep(updated.user, updated.profile);
}

// --- Staff ---

export async function listStaff(dealershipId, query) {
  const { page, limit, q } = query;
  const where = { dealershipId, deletedAt: null };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.staffMember.count({ where }),
    prisma.staffMember.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    staff: rows.map(serializeStaff),
    meta: pageMeta(total, page, limit),
  };
}

export async function getStaff(id, dealershipId) {
  const staff = await prisma.staffMember.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!staff) throw notFound("Staff member not found.");
  return serializeStaff(staff);
}

export async function createStaff(dealershipId, payload, ctx) {
  const existing = await prisma.staffMember.findFirst({
    where: { dealershipId, email: payload.email, deletedAt: null },
  });
  if (existing) throw conflict("An employee with this email already exists.");

  let payDocUrl = payload.payDocUrl ?? null;
  if (payDocUrl && payDocUrl.startsWith("data:image")) {
    const { dataUrl } = await compressDataUrl(payDocUrl, { maxBytes: 50 * 1024, maxDimension: 1000 });
    payDocUrl = dataUrl;
  }

  const staff = await prisma.staffMember.create({
    data: {
      dealershipId,
      fullName: payload.fullName.trim(),
      email: payload.email,
      phone: payload.phone,
      title: payload.title,
      payType: payload.payType,
      payRate: payload.payRate ?? 0,
      hireDate: payload.hireDate ?? null,
      payMethod: payload.payMethod ?? null,
      payDocUrl,
      isActive: payload.isActive ?? true,
    },
  });

  await writeAuditLog({
    dealershipId,
    changedById: ctx.userId,
    entityType: "StaffMember",
    entityId: staff.id,
    action: "create",
    ipAddress: ctx.ipAddress,
  });

  return serializeStaff(staff);
}

export async function updateStaff(id, dealershipId, payload) {
  const existing = await prisma.staffMember.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) throw notFound("Staff member not found.");

  if (payload.email) {
    const dup = await prisma.staffMember.findFirst({
      where: { dealershipId, email: payload.email, id: { not: id }, deletedAt: null },
    });
    if (dup) throw conflict("Another employee with this email already exists.");
  }

  let payDocUrl = payload.payDocUrl;
  if (payDocUrl && payDocUrl.startsWith("data:image")) {
    const { dataUrl } = await compressDataUrl(payDocUrl, { maxBytes: 50 * 1024, maxDimension: 1000 });
    payDocUrl = dataUrl;
  }

  const staff = await prisma.staffMember.update({
    where: { id },
    data: {
      ...(payload.fullName != null && { fullName: payload.fullName.trim() }),
      ...(payload.email !== undefined && { email: payload.email }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.payType != null && { payType: payload.payType }),
      ...(payload.payRate != null && { payRate: payload.payRate }),
      ...(payload.hireDate != null && { hireDate: payload.hireDate }),
      ...(payload.payMethod !== undefined && { payMethod: payload.payMethod }),
      ...(payDocUrl !== undefined && { payDocUrl }),
      ...(payload.isActive != null && { isActive: payload.isActive }),
    },
  });

  return serializeStaff(staff);
}

export async function deleteStaff(id, dealershipId, ctx) {
  const existing = await prisma.staffMember.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) throw notFound("Staff member not found.");

  await prisma.staffMember.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return { message: "Staff member deleted." };
}

// --- Commissions ---

export async function listCommissions(dealershipId, query, ctx) {
  const { page, limit, status, salesRepId } = query;
  const where = { dealershipId, deletedAt: null };

  if (status) where.status = status;
  if (ctx.role === "sales_rep") {
    where.salesRepId = ctx.userId;
  } else if (salesRepId) {
    where.salesRepId = salesRepId;
  }

  const [total, rows] = await Promise.all([
    prisma.salesRepCommission.count({ where }),
    prisma.salesRepCommission.findMany({
      where,
      include: {
        salesRep: { select: { id: true, fullName: true } },
        dealJacket: { select: { id: true, jacketNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    commissions: rows.map(serializeCommission),
    meta: pageMeta(total, page, limit),
  };
}

export async function updateCommission(id, dealershipId, payload, ctx) {
  const commission = await prisma.salesRepCommission.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: { salesRep: true, dealJacket: true },
  });
  if (!commission) throw notFound("Commission not found.");

  if (ctx.role === "sales_rep" && commission.salesRepId !== ctx.userId) {
    throw forbidden("You can only view your own commissions.");
  }
  if (ctx.role === "sales_rep") {
    throw forbidden("Sales reps cannot update commission status.");
  }

  const updated = await prisma.salesRepCommission.update({
    where: { id },
    data: {
      ...(payload.status != null && { status: payload.status }),
      ...(payload.commissionAmount != null && {
        commissionAmount: payload.commissionAmount,
      }),
    },
    include: {
      salesRep: { select: { id: true, fullName: true } },
      dealJacket: { select: { id: true, jacketNumber: true } },
    },
  });

  return serializeCommission(updated);
}

export async function markCommissionPaid(id, dealershipId, ctx) {
  if (!["owner", "manager", "platform_owner"].includes(ctx.role)) {
    throw forbidden("Only managers can mark commissions as paid.");
  }

  const commission = await prisma.salesRepCommission.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: {
      salesRep: { select: { id: true, fullName: true } },
      dealJacket: { select: { id: true, jacketNumber: true } },
    },
  });
  if (!commission) throw notFound("Commission not found.");

  const updated = await prisma.salesRepCommission.update({
    where: { id },
    data: {
      status: "paid",
      paidAt: new Date(),
      paidById: ctx.userId,
    },
    include: {
      salesRep: { select: { id: true, fullName: true } },
      dealJacket: { select: { id: true, jacketNumber: true } },
    },
  });

  return serializeCommission(updated);
}

// --- Payroll runs ---

export async function listPayrollRuns(dealershipId, query) {
  const { page, limit } = query;
  const where = { dealershipId };

  const [total, rows] = await Promise.all([
    prisma.payrollRun.count({ where }),
    prisma.payrollRun.findMany({
      where,
      include: {
        items: {
          include: {
            staffMember: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { periodStart: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    payrollRuns: rows.map(serializePayrollRun),
    meta: pageMeta(total, page, limit),
  };
}

export async function getPayrollRun(id, dealershipId) {
  const run = await prisma.payrollRun.findFirst({
    where: { id, dealershipId },
    include: {
      items: {
        include: {
          staffMember: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!run) throw notFound("Payroll run not found.");
  return serializePayrollRun(run);
}

export async function createPayrollRun(dealershipId, payload, ctx) {
  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        dealershipId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        notes: payload.notes ?? null,
        totalAmount,
        createdById: ctx.userId,
        items: {
          create: payload.items.map((item) => ({
            staffMemberId: item.staffMemberId ?? null,
            salesRepId: item.salesRepId ?? null,
            description: item.description,
            amount: item.amount,
            proofPath: item.proofPath ?? null,
          })),
        },
      },
      include: {
        items: {
          include: {
            staffMember: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return created;
  });

  return serializePayrollRun(run);
}

export async function updatePayrollRun(id, dealershipId, payload, ctx) {
  const existing = await prisma.payrollRun.findFirst({
    where: { id, dealershipId },
    include: { items: true },
  });
  if (!existing) throw notFound("Payroll run not found.");

  const run = await prisma.$transaction(async (tx) => {
    let totalAmount = toNum(existing.totalAmount) ?? 0;

    if (payload.items) {
      await tx.payrollPayoutItem.deleteMany({ where: { payrollRunId: id } });
      totalAmount = payload.items.reduce((sum, item) => sum + item.amount, 0);
      await tx.payrollPayoutItem.createMany({
        data: payload.items.map((item) => ({
          payrollRunId: id,
          staffMemberId: item.staffMemberId ?? null,
          salesRepId: item.salesRepId ?? null,
          description: item.description,
          amount: item.amount,
          proofPath: item.proofPath ?? null,
        })),
      });
    }

    return tx.payrollRun.update({
      where: { id },
      data: {
        ...(payload.status != null && {
          status: payload.status,
          ...(payload.status === "processed" && { processedAt: new Date() }),
        }),
        ...(payload.notes !== undefined && { notes: payload.notes }),
        ...(payload.items && { totalAmount }),
      },
      include: {
        items: {
          include: {
            staffMember: { select: { id: true, fullName: true } },
          },
        },
      },
    });
  });

  return serializePayrollRun(run);
}

export async function deletePayrollRun(id, dealershipId) {
  const existing = await prisma.payrollRun.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) throw notFound("Payroll run not found.");
  if (existing.status === "paid") {
    throw conflict("Cannot delete a paid payroll run.");
  }

  await prisma.payrollRun.delete({ where: { id } });
  return { message: "Payroll run deleted." };
}
