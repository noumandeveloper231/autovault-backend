import { toNum, roundMoney } from "../../common/serialize.js";

/**
 * Expand dealership expenses into amounts that belong in a date range.
 * Recurring templates carry forward from their expenseDate until deleted
 * or switched off recurring (Weekly/Monthly every month; Quarterly every
 * 3 months from start; Annual on the anniversary month).
 */
export function expenseAmountInRange(expense, from, to) {
  const amount = toNum(expense.amount) ?? 0;
  if (!amount) return 0;

  const start = toDateOnly(expense.expenseDate);
  if (!start) return 0;

  const rangeStart = toDateOnly(from);
  const rangeEnd = toDateOnly(to);
  if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) return 0;

  const isRecurring =
    !!expense.isRecurring &&
    expense.recurringFrequency &&
    expense.recurringFrequency !== "One-Time";

  if (!isRecurring) {
    return start >= rangeStart && start <= rangeEnd ? amount : 0;
  }

  const freq = expense.recurringFrequency;
  let total = 0;
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  while (cursor <= endMonth) {
    if (recurringOccursInMonth(start, freq, cursor.getFullYear(), cursor.getMonth())) {
      total += occurrenceAmount(amount, freq);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return total;
}

export function sumExpensesInRange(expenses, from, to, { excludeVehicleVin = false } = {}) {
  let total = 0;
  for (const e of expenses) {
    if (excludeVehicleVin && e.vehicleVin) continue;
    total += expenseAmountInRange(e, from, to);
  }
  return roundMoney(total);
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).slice(0, 10);
  const parts = s.split("-");
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m, d);
}

function recurringOccursInMonth(start, freq, year, month) {
  const startIdx = start.getFullYear() * 12 + start.getMonth();
  const targetIdx = year * 12 + month;
  if (targetIdx < startIdx) return false;
  switch (freq) {
    case "Weekly":
    case "Monthly":
      return true;
    case "Quarterly":
      return (targetIdx - startIdx) % 3 === 0;
    case "Annual":
      return month === start.getMonth();
    default:
      return false;
  }
}

function occurrenceAmount(amount, freq) {
  if (freq === "Weekly") return amount * 4.333;
  return amount;
}
