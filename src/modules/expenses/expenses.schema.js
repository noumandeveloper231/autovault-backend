import { z } from "zod";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Payroll",
  "Commissions",
  "Auction fees",
  "Flooring fees",
  "Vehicle repairs",
  "Transportation fees",
  "DMV / registration fees",
  "Office expenses",
  "Marketing / advertising",
  "Utilities",
  "Insurance",
  "Software / subscriptions",
  "Miscellaneous",
];

const RECURRING_FREQUENCIES = ["One-Time", "Weekly", "Monthly", "Quarterly", "Annual"];
const EXPENSE_STATUSES = ["paid", "unpaid"];

export const createExpenseSchema = z.object({
  expenseDate: z.coerce.date(),
  category: z.string().min(1).default("Miscellaneous"),
  name: z.string().min(1),
  vendor: z.string().optional(),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  status: z.enum(EXPENSE_STATUSES).default("unpaid"),
  recurringFrequency: z.enum(RECURRING_FREQUENCIES).default("One-Time"),
  vehicleVin: z.string().nullish(),
  referenceNumber: z.string().nullish(),
  paymentMethod: z.string().nullish(),
  receiptStoragePath: z.string().nullish(),
  notes: z.string().nullish(),
  taxDeductible: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const expenseIdParamSchema = z.object({
  id: z.string().uuid(),
});
