import { prisma } from "../../lib/prisma.js";
import { notFound, conflict, forbidden } from "../../common/errors.js";
import { writeAuditLog } from "../../common/audit.js";
import { toNum, roundMoney } from "../../common/serialize.js";
import { pageMeta } from "../../common/validate.js";
import {
  nextJacketNumber,
  createJacketActivity,
  serializeDealJacket,
} from "../jackets/jackets.service.js";

function serializeVehicle(v) {
  if (!v) return null;
  return {
    id: v.id,
    vin: v.vin,
    stockNumber: v.stockNumber,
    make: v.make,
    model: v.model,
    trim: v.trim,
    year: v.year,
    status: v.status,
    soldAt: v.soldAt,
    soldPrice: toNum(v.soldPrice),
    totalInvested: toNum(v.totalInvested),
    askingPrice: toNum(v.askingPrice),
    customer: v.deal?.customer
      ? {
          id: v.deal.customer.id,
          name: v.deal.customer.name,
          phone: v.deal.customer.phone,
          email: v.deal.customer.email,
        }
      : null,
    deal: v.deal
      ? {
          id: v.deal.id,
          saleDate: v.deal.saleDate,
          totalPriceOtd: toNum(v.deal.totalPriceOtd),
          netProfit: toNum(v.deal.netProfit),
        }
      : null,
    dealJacket: v.dealJackets?.[0]
      ? serializeDealJacket(v.dealJackets[0])
      : null,
  };
}

async function assertVehicleForDeal(vehicleId, dealershipId) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, dealershipId, deletedAt: null },
    include: {
      expenses: { where: { deletedAt: null } },
      deal: true,
      dealJackets: { where: { deletedAt: null }, take: 1 },
    },
  });
  if (!vehicle) throw notFound("Vehicle not found.");
  if (vehicle.status === "sold") {
    throw conflict("Vehicle is already marked as sold.");
  }
  if (vehicle.status === "loss") {
    throw conflict("Vehicle is already marked as a loss.");
  }
  if (vehicle.deal || vehicle.dealJackets.length > 0) {
    throw conflict("A deal already exists for this vehicle.");
  }
  return vehicle;
}

async function resolveCustomer(dealershipId, payload, createdById, tx) {
  if (payload.customerId) {
    const existing = await tx.customer.findFirst({
      where: {
        id: payload.customerId,
        dealershipId,
        deletedAt: null,
      },
    });
    if (!existing) throw notFound("Customer not found.");
    await tx.customer.update({
      where: { id: existing.id },
      data: { status: "customer" },
    });
    return existing.id;
  }

  const phone = payload.customerPhone?.trim() || null;
  const email = payload.customerEmail?.trim() || null;

  let existing = null;
  if (phone || email) {
    existing = await tx.customer.findFirst({
      where: {
        dealershipId,
        deletedAt: null,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      data: {
        name: payload.customerName ?? existing.name,
        phone: phone ?? existing.phone,
        email: email ?? existing.email,
        address: payload.customerAddress ?? existing.address,
        city: payload.customerCity ?? existing.city,
        state: payload.customerState ?? existing.state,
        zip: payload.customerZip ?? existing.zip,
        status: "customer",
      },
    });
    return existing.id;
  }

  const created = await tx.customer.create({
    data: {
      dealershipId,
      type: "individual",
      name: payload.customerName,
      phone,
      email,
      address: payload.customerAddress ?? null,
      city: payload.customerCity ?? null,
      state: payload.customerState ?? null,
      zip: payload.customerZip ?? null,
      status: "customer",
      salesRepId: payload.salesRepId ?? null,
      createdById,
    },
  });
  return created.id;
}

async function resolveCommissionRate(salesRepId) {
  if (!salesRepId) return 0;
  const profile = await prisma.salesRepProfile.findFirst({
    where: { userId: salesRepId },
  });
  const rate = toNum(profile?.commissionRate);
  return rate != null && rate >= 0 ? rate : 0.1;
}

export async function markSold(vehicleId, payload, ctx) {
  const { dealershipId, userId, role } = ctx;
  if (!["owner", "manager", "platform_owner"].includes(role)) {
    throw forbidden("Only managers can mark vehicles as sold.");
  }

  const vehicle = await assertVehicleForDeal(vehicleId, dealershipId);
  const soldPrice = roundMoney(payload.soldPrice);
  const totalInvested = toNum(vehicle.totalInvested) ?? 0;
  const grossProfit = roundMoney(soldPrice - totalInvested);
  const commissionRate =
    payload.commissionRate ??
    (payload.salesRepId ? await resolveCommissionRate(payload.salesRepId) : 0);
  const commissionAmount =
    payload.commissionAmount != null
      ? roundMoney(payload.commissionAmount)
      : roundMoney(Math.max(0, grossProfit) * commissionRate);

  const salesTax = roundMoney(payload.salesTaxAmount ?? 0);
  const licenseFees = roundMoney(payload.licenseFees ?? 0);
  const additionalExpenses = roundMoney(payload.additionalExpenses ?? 0);
  const totalPriceOtd = roundMoney(soldPrice + salesTax + licenseFees);

  // Sequential writes (not interactive $transaction) — Neon pooled
  // connections drop interactive transactions mid-flight.
  const customerId = await resolveCustomer(
    dealershipId,
    payload,
    userId,
    prisma,
  );

  const deal = await prisma.deal.create({
    data: {
      vehicleId,
      customerId,
      dealershipId,
      saleDate: payload.saleDate,
      totalPriceOtd,
      totalCollected: totalPriceOtd,
      salesTaxAmount: salesTax,
      licenseFees,
      soldPriceBeforeTax: soldPrice,
      commissionAmount,
      commissionRate: commissionRate > 0 ? commissionRate : null,
      commissionType: payload.commissionType ?? "percentage",
      netProfit: roundMoney(grossProfit - commissionAmount - additionalExpenses),
      salesRepId: payload.salesRepId ?? null,
      rosNumber: payload.rosNumber ?? null,
      notes: payload.notes ?? null,
      createdById: userId,
    },
  });

  const jacketNumber = await nextJacketNumber(dealershipId, prisma);
  const profitNet = roundMoney(grossProfit - commissionAmount - additionalExpenses);

  const jacket = await prisma.dealJacket.create({
    data: {
      dealershipId,
      vehicleId,
      customerId,
      dealId: deal.id,
      salesRepId: payload.salesRepId ?? null,
      jacketNumber,
      soldPrice,
      totalTax: salesTax,
      totalSalePrice: totalPriceOtd,
      totalInvested,
      additionalExpenses,
      commissionAmount,
      profitGross: grossProfit,
      profitNet,
      workflowStatus: "approved",
      dateSold: payload.saleDate,
      rosNumber: payload.rosNumber ?? null,
      notes: payload.notes ?? null,
      fees: payload.fees ?? {},
      createdById: userId,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });

  const soldAt = payload.saleDate;
  const updatedVehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      status: "sold",
      soldAt,
      soldPrice,
    },
  });

  await prisma.vehicleStatusHistory.create({
    data: {
      vehicleId,
      dealershipId,
      fromStatus: vehicle.status,
      toStatus: "sold",
      note: `Sold via jacket ${jacketNumber}`,
      changedById: userId,
    },
  });

  await createJacketActivity(
    {
      dealJacketId: jacket.id,
      action: "created",
      actorId: userId,
      actorName: ctx.actorName ?? "System",
      oldStatus: null,
      newStatus: "approved",
      detail: { source: "mark_sold" },
    },
    prisma,
  );

  if (jacket.salesRepId && toNum(jacket.commissionAmount) > 0) {
    const commRate = await resolveCommissionRate(jacket.salesRepId);
    await prisma.salesRepCommission.create({
      data: {
        dealershipId,
        salesRepId: jacket.salesRepId,
        dealJacketId: jacket.id,
        commissionAmount: toNum(jacket.commissionAmount) ?? 0,
        grossProfit: toNum(jacket.profitGross) ?? 0,
        soldPrice: toNum(jacket.soldPrice) ?? 0,
        commissionRate: commRate,
        status: "approved",
      },
    });
  }

  await createJacketActivity(
    {
      dealJacketId: jacket.id,
      action: "approved",
      actorId: userId,
      actorName: ctx.actorName ?? "System",
      oldStatus: null,
      newStatus: "approved",
      detail: { source: "mark_sold", autoApproved: true },
    },
    prisma,
  );

  const result = { deal, jacket, vehicle: updatedVehicle };
  await writeAuditLog({
    dealershipId,
    changedById: userId,
    entityType: "Vehicle",
    entityId: vehicleId,
    action: "mark_sold",
    newValues: {
      soldPrice,
      grossProfit,
      dealId: result.deal.id,
      dealJacketId: result.jacket.id,
    },
    ipAddress: ctx.ipAddress,
  });

  return {
    deal: serializeRecord(result.deal),
    dealJacket: serializeDealJacket(result.jacket),
    vehicle: serializeVehicle({
      ...result.vehicle,
      deal: result.deal,
      dealJackets: [result.jacket],
    }),
  };
}

export async function markLoss(vehicleId, payload, ctx) {
  const { dealershipId, userId, role } = ctx;
  if (!["owner", "manager", "platform_owner"].includes(role)) {
    throw forbidden("Only managers can mark vehicles as a loss.");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, dealershipId, deletedAt: null },
  });
  if (!vehicle) throw notFound("Vehicle not found.");
  if (vehicle.status === "sold") {
    throw conflict("Cannot mark a sold vehicle as a loss.");
  }
  if (vehicle.status === "loss") {
    throw conflict("Vehicle is already marked as a loss.");
  }

  const [updated] = await prisma.$transaction([
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: "loss" },
    }),
    prisma.vehicleStatusHistory.create({
      data: {
        vehicleId,
        dealershipId,
        fromStatus: vehicle.status,
        toStatus: "loss",
        note: payload.note ?? "Marked as loss",
        changedById: userId,
      },
    }),
  ]);

  await writeAuditLog({
    dealershipId,
    changedById: userId,
    entityType: "Vehicle",
    entityId: vehicleId,
    action: "mark_loss",
    newValues: { note: payload.note },
    ipAddress: ctx.ipAddress,
  });

  return serializeVehicle(updated);
}

export async function listSoldVehicles(dealershipId, query) {
  const { page, limit, q, from, to } = query;
  const where = {
    dealershipId,
    deletedAt: null,
    status: "sold",
  };

  if (from || to) {
    where.soldAt = {};
    if (from) where.soldAt.gte = from;
    if (to) where.soldAt.lte = to;
  }

  if (q) {
    where.OR = [
      { vin: { contains: q, mode: "insensitive" } },
      { stockNumber: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      include: {
        deal: {
          include: {
            customer: true,
          },
        },
        dealJackets: {
          where: { deletedAt: null },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { soldAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    vehicles: rows.map(serializeVehicle),
    meta: pageMeta(total, page, limit),
  };
}

function serializeRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    vehicleId: record.vehicleId,
    customerId: record.customerId,
    saleDate: record.saleDate,
    totalPriceOtd: toNum(record.totalPriceOtd),
    totalCollected: toNum(record.totalCollected),
    salesTaxAmount: toNum(record.salesTaxAmount),
    netProfit: toNum(record.netProfit),
    commissionAmount: toNum(record.commissionAmount),
    createdAt: record.createdAt,
  };
}
