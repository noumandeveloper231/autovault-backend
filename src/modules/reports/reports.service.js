import { prisma } from "../../lib/prisma.js";
import { toNum, roundMoney } from "../../common/serialize.js";
import { sumExpensesInRange } from "../expenses/recurring-expenses.js";

function defaultDateRange(from, to) {
  const now = new Date();
  const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ?? now;
  return { from: start, to: end };
}

export async function profitLoss(dealershipId, { from, to } = {}) {
  const range = defaultDateRange(from, to);

  const jackets = await prisma.dealJacket.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      workflowStatus: "approved",
      dateSold: { gte: range.from, lte: range.to },
    },
    select: {
      soldPrice: true,
      totalInvested: true,
      profitGross: true,
      profitNet: true,
      commissionAmount: true,
    },
  });

  const revenue = roundMoney(
    jackets.reduce((sum, j) => sum + (toNum(j.soldPrice) ?? 0), 0),
  );
  const cogs = roundMoney(
    jackets.reduce((sum, j) => sum + (toNum(j.totalInvested) ?? 0), 0),
  );
  const gross = roundMoney(revenue - cogs);

  // Include one-time expenses in-range plus recurring templates that
  // carry forward into months covered by the period.
  const expenseRows = await prisma.dealershipExpense.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      OR: [
        { expenseDate: { gte: range.from, lte: range.to } },
        {
          isRecurring: true,
          expenseDate: { lte: range.to },
          NOT: { recurringFrequency: "One-Time" },
        },
      ],
    },
    select: {
      amount: true,
      expenseDate: true,
      isRecurring: true,
      recurringFrequency: true,
      vehicleVin: true,
    },
  });
  const operatingExpenses = sumExpensesInRange(expenseRows, range.from, range.to, {
    excludeVehicleVin: true,
  });

  const commissionsPaid = await prisma.salesRepCommission.aggregate({
    where: {
      dealershipId,
      deletedAt: null,
      status: "paid",
      paidAt: { gte: range.from, lte: range.to },
    },
    _sum: { commissionAmount: true },
  });
  const commissionsTotal = roundMoney(
    toNum(commissionsPaid._sum.commissionAmount) ?? 0,
  );

  const net = roundMoney(gross - operatingExpenses - commissionsTotal);

  return {
    period: {
      from: range.from,
      to: range.to,
    },
    revenue,
    cogs,
    gross,
    operatingExpenses,
    commissionsPaid: commissionsTotal,
    net,
    soldVehicleCount: jackets.length,
  };
}
