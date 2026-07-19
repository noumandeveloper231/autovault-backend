import { z } from "zod";

const customerFields = {
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  customerEmail: z
    .string()
    .email()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? undefined : v)),
  customerAddress: z.string().optional(),
};

export const markSoldSchema = z
  .object({
    ...customerFields,
    saleDate: z.coerce.date(),
    soldPrice: z.coerce.number().positive(),
    salesTaxAmount: z.coerce.number().min(0).default(0),
    licenseFees: z.coerce.number().min(0).default(0),
    salesRepId: z.string().uuid().nullable().optional(),
    commissionType: z.enum(["percentage", "manual"]).optional(),
    commissionRate: z.coerce.number().min(0).max(1).optional(),
    commissionAmount: z.coerce.number().min(0).optional(),
    rosNumber: z.string().optional(),
    notes: z.string().optional(),
    workflowStatus: z
      .enum(["draft", "pending_review"])
      .default("pending_review"),
    additionalExpenses: z.coerce.number().min(0).default(0),
    fees: z.any().default({}),
  })
  .refine(
    (d) => d.customerId || d.customerName,
    { message: "customerId or customerName is required" },
  );

export const markLossSchema = z.object({
  note: z.string().optional(),
  lossDate: z.coerce.date().optional(),
});

export const soldVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const vehicleIdParamSchema = z.object({
  id: z.string().uuid(),
});
