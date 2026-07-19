import { prisma } from "../../lib/prisma.js";
import { notFound, conflict, forbidden } from "../../common/errors.js";
import { writeAuditLog } from "../../common/audit.js";
import { toNum, roundMoney } from "../../common/serialize.js";
import { pageMeta } from "../../common/validate.js";
import { compressDataUrl } from "../../utils/image-compress.js";

const FINAL_STATUSES = ["approved", "rejected"];

export async function nextJacketNumber(dealershipId, tx = prisma) {
  const count = await tx.dealJacket.count({
    where: { dealershipId },
  });
  return `DJ-${String(count + 1).padStart(6, "0")}`;
}

export async function createJacketActivity(data, tx = prisma) {
  return tx.dealJacketActivity.create({ data });
}

export function serializeDealJacket(j) {
  if (!j) return null;
  return {
    id: j.id,
    dealershipId: j.dealershipId,
    vehicleId: j.vehicleId,
    customerId: j.customerId,
    dealId: j.dealId,
    salesRepId: j.salesRepId,
    jacketNumber: j.jacketNumber,
    soldPrice: toNum(j.soldPrice),
    totalTax: toNum(j.totalTax),
    totalSalePrice: toNum(j.totalSalePrice),
    downPayment: toNum(j.downPayment),
    amountFinanced: toNum(j.amountFinanced),
    balanceDue: toNum(j.balanceDue),
    totalInvested: toNum(j.totalInvested),
    additionalExpenses: toNum(j.additionalExpenses),
    commissionAmount: toNum(j.commissionAmount),
    profitGross: toNum(j.profitGross),
    profitNet: toNum(j.profitNet),
    tradeInAllowance: toNum(j.tradeInAllowance),
    warrantyAmount: toNum(j.warrantyAmount),
    gapAmount: toNum(j.gapAmount),
    fees: j.fees ?? {},
    lender: j.lender,
    rosNumber: j.rosNumber,
    notes: j.notes,
    reviewNotes: j.reviewNotes,
    rejectionReason: j.rejectionReason,
    dealType: j.dealType,
    workflowStatus: j.workflowStatus,
    dateSold: j.dateSold,
    reviewedAt: j.reviewedAt,
    reviewedById: j.reviewedById,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    vehicle: j.vehicle
      ? {
          id: j.vehicle.id,
          vin: j.vehicle.vin,
          stockNumber: j.vehicle.stockNumber,
          make: j.vehicle.make,
          model: j.vehicle.model,
          year: j.vehicle.year,
          status: j.vehicle.status,
        }
      : undefined,
    customer: j.customer
      ? {
          id: j.customer.id,
          name: j.customer.name,
          phone: j.customer.phone,
          email: j.customer.email,
        }
      : undefined,
    salesRep: j.salesRep
      ? {
          id: j.salesRep.id,
          fullName: j.salesRep.fullName,
          email: j.salesRep.email,
        }
      : undefined,
    documents: j.documents?.map((d) => ({
      id: d.id,
      fileUrl: d.fileUrl,
      documentName: d.documentName,
      fileType: d.fileType,
      uploadedAt: d.uploadedAt,
    })),
    commission: j.commission
      ? {
          id: j.commission.id,
          status: j.commission.status,
          commissionAmount: toNum(j.commission.commissionAmount),
        }
      : undefined,
  };
}

function jacketInclude() {
  return {
    vehicle: true,
    customer: true,
    salesRep: {
      select: { id: true, fullName: true, email: true },
    },
    documents: { orderBy: { uploadedAt: "desc" } },
    commission: true,
  };
}

async function getJacketOrThrow(id, dealershipId) {
  const jacket = await prisma.dealJacket.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: jacketInclude(),
  });
  if (!jacket) throw notFound("Deal jacket not found.");
  return jacket;
}

function assertSalesRepAccess(jacket, ctx, write = false) {
  if (["owner", "manager", "cpa", "platform_owner"].includes(ctx.role)) {
    return;
  }
  if (ctx.role === "sales_rep") {
    if (jacket.salesRepId !== ctx.userId) {
      throw forbidden("You can only access your own deal jackets.");
    }
    if (write && ["approved", "rejected"].includes(jacket.workflowStatus)) {
      throw forbidden("This deal jacket can no longer be edited.");
    }
    return;
  }
  throw forbidden("You do not have permission for this action.");
}

function assertManagerAction(ctx) {
  if (!["owner", "manager", "platform_owner"].includes(ctx.role)) {
    throw forbidden("Only managers can perform this action.");
  }
}

async function resolveCommissionRate(salesRepId) {
  if (!salesRepId) return 0;
  const profile = await prisma.salesRepProfile.findFirst({
    where: { userId: salesRepId },
  });
  const rate = toNum(profile?.commissionRate);
  return rate != null && rate >= 0 ? rate : 0.1;
}

function computeFinancials(vehicle, payload) {
  const vehicleInvested = toNum(vehicle.totalInvested) ?? 0;
  const soldPrice = roundMoney(payload.soldPrice);
  const profitGross = roundMoney(soldPrice - vehicleInvested);
  const commissionRate = payload.commissionRate ?? 0.1;
  const commissionAmount =
    payload.commissionAmount != null
      ? roundMoney(payload.commissionAmount)
      : roundMoney(Math.max(0, profitGross) * commissionRate);
  const additionalExpenses = roundMoney(payload.additionalExpenses ?? 0);
  const profitNet = roundMoney(
    profitGross - commissionAmount - additionalExpenses,
  );
  const totalSalePrice =
    payload.totalSalePrice ??
    soldPrice + (payload.totalTax ?? 0);

  return {
    soldPrice,
    totalInvested: vehicleInvested,
    profitGross,
    commissionAmount,
    profitNet,
    totalSalePrice: roundMoney(totalSalePrice),
    balanceDue: roundMoney(
      totalSalePrice - (payload.downPayment ?? 0),
    ),
  };
}

async function logTransition(jacket, action, ctx, extra = {}) {
  await createJacketActivity({
    dealJacketId: jacket.id,
    action,
    actorId: ctx.userId,
    actorName: ctx.actorName ?? "User",
    oldStatus: extra.oldStatus ?? jacket.workflowStatus,
    newStatus: extra.newStatus,
    detail: extra.detail ?? null,
  });
}

export async function listJackets(dealershipId, query, ctx) {
  const { page, limit, q, workflowStatus, salesRepId } = query;
  const where = { dealershipId, deletedAt: null };

  if (workflowStatus) where.workflowStatus = workflowStatus;
  if (ctx.role === "sales_rep") {
    where.salesRepId = ctx.userId;
  } else if (salesRepId) {
    where.salesRepId = salesRepId;
  }

  if (q) {
    where.OR = [
      { jacketNumber: { contains: q, mode: "insensitive" } },
      { rosNumber: { contains: q, mode: "insensitive" } },
      { vehicle: { vin: { contains: q, mode: "insensitive" } } },
      { vehicle: { stockNumber: { contains: q, mode: "insensitive" } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.dealJacket.count({ where }),
    prisma.dealJacket.findMany({
      where,
      include: jacketInclude(),
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    dealJackets: rows.map(serializeDealJacket),
    meta: pageMeta(total, page, limit),
  };
}

export async function getJacket(id, dealershipId, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx);
  return serializeDealJacket(jacket);
}

export async function createJacket(dealershipId, payload, ctx) {
  if (!["owner", "manager", "sales_rep", "platform_owner"].includes(ctx.role)) {
    throw forbidden("You cannot create deal jackets.");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: payload.vehicleId,
      dealershipId,
      deletedAt: null,
    },
  });
  if (!vehicle) throw notFound("Vehicle not found.");
  if (["sold", "loss"].includes(vehicle.status)) {
    throw conflict("Vehicle is not available for a deal jacket.");
  }

  const existing = await prisma.dealJacket.findFirst({
    where: { vehicleId: payload.vehicleId, deletedAt: null },
  });
  if (existing) throw conflict("A deal jacket already exists for this vehicle.");

  const customer = await prisma.customer.findFirst({
    where: {
      id: payload.customerId,
      dealershipId,
      deletedAt: null,
    },
  });
  if (!customer) throw notFound("Customer not found.");

  const salesRepId =
    ctx.role === "sales_rep" ? ctx.userId : (payload.salesRepId ?? null);
  const commissionRate =
    payload.commissionRate ?? (await resolveCommissionRate(salesRepId));
  const financials = computeFinancials(vehicle, {
    ...payload,
    commissionRate,
  });

  const jacket = await prisma.$transaction(async (tx) => {
    const jacketNumber = await nextJacketNumber(dealershipId, tx);
    const created = await tx.dealJacket.create({
      data: {
        dealershipId,
        vehicleId: payload.vehicleId,
        customerId: payload.customerId,
        salesRepId,
        jacketNumber,
        soldPrice: financials.soldPrice,
        totalTax: roundMoney(payload.totalTax ?? 0),
        totalSalePrice: financials.totalSalePrice,
        downPayment: roundMoney(payload.downPayment ?? 0),
        amountFinanced: roundMoney(payload.amountFinanced ?? 0),
        balanceDue: financials.balanceDue,
        totalInvested: financials.totalInvested,
        additionalExpenses: roundMoney(payload.additionalExpenses ?? 0),
        commissionAmount: financials.commissionAmount,
        profitGross: financials.profitGross,
        profitNet: financials.profitNet,
        tradeInAllowance: roundMoney(payload.tradeInAllowance ?? 0),
        warrantyAmount: roundMoney(payload.warrantyAmount ?? 0),
        gapAmount: roundMoney(payload.gapAmount ?? 0),
        fees: payload.fees ?? {},
        lender: payload.lender ?? null,
        rosNumber: payload.rosNumber ?? null,
        notes: payload.notes ?? null,
        dealType: payload.dealType ?? "Retail",
        workflowStatus: "draft",
        dateSold: payload.dateSold ?? new Date(),
        createdById: ctx.userId,
      },
      include: jacketInclude(),
    });

    await tx.vehicle.update({
      where: { id: payload.vehicleId },
      data: { status: "pending_deal" },
    });

    await createJacketActivity(
      {
        dealJacketId: created.id,
        action: "created",
        actorId: ctx.userId,
        actorName: ctx.actorName ?? "User",
        oldStatus: null,
        newStatus: "draft",
      },
      tx,
    );

    return created;
  });

  return serializeDealJacket(jacket);
}

export async function updateJacket(id, dealershipId, payload, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx, true);

  var onlyFees = payload.fees != null || payload.additionalExpenses != null;
  var otherFields = Object.keys(payload).filter(function(k) { return k !== 'fees' && k !== 'additionalExpenses'; });
  if (FINAL_STATUSES.includes(jacket.workflowStatus) && otherFields.length > 0) {
    throw conflict(`Deal jacket is already ${jacket.workflowStatus}.`);
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: jacket.vehicleId, dealershipId, deletedAt: null },
  });
  if (!vehicle) throw notFound("Vehicle not found.");

  const merged = {
    soldPrice: payload.soldPrice ?? toNum(jacket.soldPrice),
    totalTax: payload.totalTax ?? toNum(jacket.totalTax),
    totalSalePrice: payload.totalSalePrice ?? toNum(jacket.totalSalePrice),
    downPayment: payload.downPayment ?? toNum(jacket.downPayment),
    additionalExpenses:
      payload.additionalExpenses ?? toNum(jacket.additionalExpenses),
    commissionRate:
      payload.commissionRate ??
      (jacket.salesRepId
        ? await resolveCommissionRate(jacket.salesRepId)
        : 0),
    commissionAmount:
      payload.commissionAmount ?? toNum(jacket.commissionAmount),
  };

  const financials = computeFinancials(vehicle, merged);
  const data = {
    ...(payload.soldPrice != null && { soldPrice: financials.soldPrice }),
    ...(payload.totalTax != null && {
      totalTax: roundMoney(payload.totalTax),
    }),
    ...(payload.totalSalePrice != null && {
      totalSalePrice: financials.totalSalePrice,
    }),
    ...(payload.downPayment != null && {
      downPayment: roundMoney(payload.downPayment),
    }),
    ...(payload.amountFinanced != null && {
      amountFinanced: roundMoney(payload.amountFinanced),
    }),
    ...(payload.additionalExpenses != null && {
      additionalExpenses: roundMoney(payload.additionalExpenses),
    }),
    ...(payload.tradeInAllowance != null && {
      tradeInAllowance: roundMoney(payload.tradeInAllowance),
    }),
    ...(payload.warrantyAmount != null && {
      warrantyAmount: roundMoney(payload.warrantyAmount),
    }),
    ...(payload.gapAmount != null && {
      gapAmount: roundMoney(payload.gapAmount),
    }),
    ...(payload.fees != null && { fees: payload.fees }),
    ...(payload.lender !== undefined && { lender: payload.lender }),
    ...(payload.rosNumber !== undefined && { rosNumber: payload.rosNumber }),
    ...(payload.notes !== undefined && { notes: payload.notes }),
    ...(payload.dealType != null && { dealType: payload.dealType }),
    ...(payload.dateSold != null && { dateSold: payload.dateSold }),
    ...(payload.salesRepId !== undefined &&
      ctx.role !== "sales_rep" && { salesRepId: payload.salesRepId }),
    commissionAmount: financials.commissionAmount,
    profitGross: financials.profitGross,
    profitNet: financials.profitNet,
    balanceDue: financials.balanceDue,
    totalInvested: financials.totalInvested,
  };

  const updated = await prisma.dealJacket.update({
    where: { id },
    data,
    include: jacketInclude(),
  });

  await logTransition(jacket, "updated", ctx, {
    oldStatus: jacket.workflowStatus,
    newStatus: updated.workflowStatus,
  });

  return serializeDealJacket(updated);
}

async function transitionJacket(id, dealershipId, newStatus, ctx, extra = {}) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  if (FINAL_STATUSES.includes(jacket.workflowStatus)) {
    throw conflict(`Deal jacket is already ${jacket.workflowStatus}.`);
  }

  const updated = await prisma.dealJacket.update({
    where: { id },
    data: {
      workflowStatus: newStatus,
      ...extra,
    },
    include: jacketInclude(),
  });

  return { jacket, updated };
}

export async function submitJacket(id, dealershipId, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx, true);

  if (!["draft", "changes_requested"].includes(jacket.workflowStatus)) {
    throw conflict("Deal jacket cannot be submitted in its current status.");
  }

  const updated = await prisma.dealJacket.update({
    where: { id },
    data: { workflowStatus: "pending_review" },
    include: jacketInclude(),
  });

  await logTransition(jacket, "submitted", ctx, {
    oldStatus: jacket.workflowStatus,
    newStatus: "pending_review",
  });

  return serializeDealJacket(updated);
}

export async function requestChanges(id, dealershipId, payload, ctx) {
  assertManagerAction(ctx);
  const { jacket, updated } = await transitionJacket(
    id,
    dealershipId,
    "changes_requested",
    ctx,
    {
      reviewNotes: payload.reviewNotes,
      reviewedById: ctx.userId,
      reviewedAt: new Date(),
    },
  );

  await logTransition(jacket, "changes_requested", ctx, {
    oldStatus: jacket.workflowStatus,
    newStatus: "changes_requested",
    detail: {
      reviewNotes: payload.reviewNotes,
      changeCategories: payload.changeCategories,
    },
  });

  return serializeDealJacket(updated);
}

export async function resubmitJacket(id, dealershipId, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx, true);

  if (jacket.workflowStatus !== "changes_requested") {
    throw conflict("Only jackets with changes requested can be resubmitted.");
  }

  const updated = await prisma.dealJacket.update({
    where: { id },
    data: { workflowStatus: "resubmitted" },
    include: jacketInclude(),
  });

  await logTransition(jacket, "resubmitted", ctx, {
    oldStatus: jacket.workflowStatus,
    newStatus: "resubmitted",
  });

  return serializeDealJacket(updated);
}

async function createCommissionOnApprove(jacket, tx) {
  if (!jacket.salesRepId) return null;
  const rate = await resolveCommissionRate(jacket.salesRepId);
  if (rate <= 0 && toNum(jacket.commissionAmount) <= 0) return null;

  const existing = await tx.salesRepCommission.findFirst({
    where: { dealJacketId: jacket.id, deletedAt: null },
  });
  if (existing) return existing;

  return tx.salesRepCommission.create({
    data: {
      dealershipId: jacket.dealershipId,
      salesRepId: jacket.salesRepId,
      dealJacketId: jacket.id,
      commissionAmount: toNum(jacket.commissionAmount) ?? 0,
      grossProfit: toNum(jacket.profitGross) ?? 0,
      soldPrice: toNum(jacket.soldPrice) ?? 0,
      commissionRate: rate,
      status: "approved",
    },
  });
}

export async function approveJacket(id, dealershipId, payload, ctx) {
  assertManagerAction(ctx);
  const jacket = await getJacketOrThrow(id, dealershipId);

  if (FINAL_STATUSES.includes(jacket.workflowStatus)) {
    throw conflict(`Deal jacket is already ${jacket.workflowStatus}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.dealJacket.update({
      where: { id },
      data: {
        workflowStatus: "approved",
        reviewNotes: payload.reviewNotes ?? null,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
      },
      include: jacketInclude(),
    });

    const vehicle = await tx.vehicle.findFirst({
      where: { id: jacket.vehicleId },
    });
    if (vehicle && vehicle.status !== "sold") {
      await tx.vehicle.update({
        where: { id: jacket.vehicleId },
        data: {
          status: "sold",
          soldAt: jacket.dateSold ?? new Date(),
          soldPrice: jacket.soldPrice,
        },
      });
      await tx.vehicleStatusHistory.create({
        data: {
          vehicleId: jacket.vehicleId,
          dealershipId,
          fromStatus: vehicle.status,
          toStatus: "sold",
          note: `Deal jacket ${jacket.jacketNumber} approved`,
          changedById: ctx.userId,
        },
      });
    }

    await createCommissionOnApprove(updated, tx);

    await createJacketActivity(
      {
        dealJacketId: id,
        action: "approved",
        actorId: ctx.userId,
        actorName: ctx.actorName ?? "User",
        oldStatus: jacket.workflowStatus,
        newStatus: "approved",
        detail: payload.reviewNotes
          ? { reviewNotes: payload.reviewNotes }
          : null,
      },
      tx,
    );

    return updated;
  });

  await writeAuditLog({
    dealershipId,
    changedById: ctx.userId,
    entityType: "DealJacket",
    entityId: id,
    action: "approved",
    newValues: { jacketNumber: jacket.jacketNumber },
    ipAddress: ctx.ipAddress,
  });

  return serializeDealJacket(result);
}

export async function rejectJacket(id, dealershipId, payload, ctx) {
  assertManagerAction(ctx);
  const jacket = await getJacketOrThrow(id, dealershipId);

  if (FINAL_STATUSES.includes(jacket.workflowStatus)) {
    throw conflict(`Deal jacket is already ${jacket.workflowStatus}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.dealJacket.update({
      where: { id },
      data: {
        workflowStatus: "rejected",
        rejectionReason: payload.rejectionReason,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
      },
      include: jacketInclude(),
    });

    const vehicle = await tx.vehicle.findFirst({
      where: { id: jacket.vehicleId },
    });
    if (vehicle?.status === "pending_deal") {
      await tx.vehicle.update({
        where: { id: jacket.vehicleId },
        data: { status: "in_stock" },
      });
      await tx.vehicleStatusHistory.create({
        data: {
          vehicleId: jacket.vehicleId,
          dealershipId,
          fromStatus: "pending_deal",
          toStatus: "in_stock",
          note: `Deal jacket ${jacket.jacketNumber} rejected`,
          changedById: ctx.userId,
        },
      });
    }

    const commission = await tx.salesRepCommission.findFirst({
      where: { dealJacketId: id, deletedAt: null },
    });
    if (commission) {
      await tx.salesRepCommission.update({
        where: { id: commission.id },
        data: { status: "rejected" },
      });
    }

    await createJacketActivity(
      {
        dealJacketId: id,
        action: "rejected",
        actorId: ctx.userId,
        actorName: ctx.actorName ?? "User",
        oldStatus: jacket.workflowStatus,
        newStatus: "rejected",
        detail: { rejectionReason: payload.rejectionReason },
      },
      tx,
    );

    return updated;
  });

  return serializeDealJacket(result);
}

export async function addDocument(id, dealershipId, payload, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx, true);

  let fileUrl = payload.fileUrl;
  let compressionInfo = null;

  if (fileUrl && fileUrl.startsWith("data:")) {
    const result = await compressDataUrl(fileUrl, { maxBytes: 20 * 1024, maxDimension: 800 });
    if (result.compressed) {
      fileUrl = result.dataUrl;
      compressionInfo = {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
      };
    }
  }

  const doc = await prisma.dealJacketDocument.create({
    data: {
      dealJacketId: id,
      fileUrl,
      documentName: payload.documentName,
      fileType: payload.fileType ?? "application/pdf",
    },
  });

  await logTransition(jacket, "document_added", ctx, {
    oldStatus: jacket.workflowStatus,
    newStatus: jacket.workflowStatus,
    detail: { documentName: payload.documentName, compression: compressionInfo },
  });

  return {
    id: doc.id,
    fileUrl: doc.fileUrl,
    documentName: doc.documentName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt,
  };
}

export async function getActivity(id, dealershipId, ctx) {
  const jacket = await getJacketOrThrow(id, dealershipId);
  assertSalesRepAccess(jacket, ctx);

  const rows = await prisma.dealJacketActivity.findMany({
    where: { dealJacketId: id },
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorId: r.actorId,
    actorName: r.actorName,
    actor: r.actor
      ? { id: r.actor.id, fullName: r.actor.fullName }
      : null,
    oldStatus: r.oldStatus,
    newStatus: r.newStatus,
    detail: r.detail,
    createdAt: r.createdAt,
  }));
}
