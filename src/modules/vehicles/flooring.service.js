import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../common/errors.js";
import { writeAuditLog } from "../../common/audit.js";
import { serializeDecimal, serializeDecimals } from "../../common/serialize.js";

function toNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function estimateFlooringCost(plan, principal, daysOnFloor) {
  const rate = toNumber(plan.baseRate);
  const amount = toNumber(principal);

  if (plan.rateType === "daily") {
    return rate * daysOnFloor;
  }
  if (plan.rateType === "monthly") {
    return (rate / 30) * daysOnFloor;
  }
  // apr — baseRate treated as annual percentage
  return amount * (rate / 100) * (daysOnFloor / 365);
}

function serializePlan(plan) {
  return serializeDecimals(plan);
}

export async function listFlooringPlans(dealershipId) {
  const plans = await prisma.flooringPlan.findMany({
    where: { dealershipId, deletedAt: null },
    orderBy: { effectiveDate: "desc" },
  });
  return plans.map(serializePlan);
}

export async function createFlooringPlan(
  dealershipId,
  data,
  createdById,
  ipAddress,
) {
  const plan = await prisma.flooringPlan.create({
    data: {
      dealershipId,
      createdById,
      name: data.name ?? "Standard Floor Plan",
      rateType: data.rateType ?? "monthly",
      baseRate: data.baseRate,
      effectiveDate: data.effectiveDate,
      rateIncreaseEnabled: data.rateIncreaseEnabled ?? false,
      increaseAfterDays: data.increaseAfterDays ?? null,
      increaseAmountType: data.increaseAmountType ?? null,
      increaseAmount: data.increaseAmount ?? null,
      maxCap: data.maxCap ?? null,
      buyFee: data.buyFee ?? null,
      lateFeePerDay: data.lateFeePerDay ?? null,
      lateFeeAfterDays: data.lateFeeAfterDays ?? null,
      gracePeriodDays: data.gracePeriodDays ?? null,
      isActive: data.isActive ?? true,
    },
  });

  await writeAuditLog({
    dealershipId,
    changedById: createdById,
    entityType: "FlooringPlan",
    entityId: plan.id,
    action: "create",
    ipAddress,
  });

  return serializePlan(plan);
}

export async function updateFlooringPlan(
  dealershipId,
  planId,
  data,
  changedById,
  ipAddress,
) {
  const existing = await prisma.flooringPlan.findFirst({
    where: { id: planId, dealershipId, deletedAt: null },
  });
  if (!existing) throw notFound("Flooring plan not found.");

  const plan = await prisma.flooringPlan.update({
    where: { id: planId },
    data,
  });

  await writeAuditLog({
    dealershipId,
    changedById,
    entityType: "FlooringPlan",
    entityId: planId,
    action: "update",
    ipAddress,
  });

  return serializePlan(plan);
}

export async function deleteFlooringPlan(
  dealershipId,
  planId,
  changedById,
  ipAddress,
) {
  const existing = await prisma.flooringPlan.findFirst({
    where: { id: planId, dealershipId, deletedAt: null },
  });
  if (!existing) throw notFound("Flooring plan not found.");

  const plan = await prisma.flooringPlan.update({
    where: { id: planId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writeAuditLog({
    dealershipId,
    changedById,
    entityType: "FlooringPlan",
    entityId: planId,
    action: "soft_delete",
    ipAddress,
  });

  return serializePlan(plan);
}

export async function getFlooringBreakdown(dealershipId, { asOfDate }) {
  const asOf = asOfDate ?? new Date();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      flooringPlanId: { not: null },
      flooringStartDate: { not: null },
    },
    include: { flooringPlan: true },
  });

  const items = vehicles.map((vehicle) => {
    const daysOnFloor = daysBetween(vehicle.flooringStartDate, asOf);
    const principal = vehicle.acquisitionCost ?? 0;
    const estimatedCost = vehicle.flooringPlan
      ? estimateFlooringCost(vehicle.flooringPlan, principal, daysOnFloor)
      : 0;

    return {
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      stockNumber: vehicle.stockNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      flooringPlanId: vehicle.flooringPlanId,
      flooringPlanName: vehicle.flooringPlan?.name ?? null,
      rateType: vehicle.flooringPlan?.rateType ?? null,
      baseRate: serializeDecimal(vehicle.flooringPlan?.baseRate),
      flooringStartDate: vehicle.flooringStartDate,
      daysOnFloor,
      principal: serializeDecimal(principal),
      estimatedFlooringCost: Math.round(estimatedCost * 100) / 100,
    };
  });

  const totalEstimatedCost = items.reduce(
    (sum, item) => sum + item.estimatedFlooringCost,
    0,
  );

  return {
    asOfDate: asOf,
    items,
    summary: {
      vehicleCount: items.length,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
    },
  };
}
