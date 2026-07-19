import { z } from "zod";

const inviteableRoles = z.enum([
  "owner",
  "manager",
  "sales_rep",
  "cpa",
  "wholesale_dealer",
]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  role: z
    .enum([
      "owner",
      "manager",
      "sales_rep",
      "cpa",
      "wholesale_dealer",
      "platform_owner",
    ])
    .optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const createUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(150),
  phone: z.string().max(30).optional().nullable(),
  role: inviteableRoles,
  imageUrl: z.string().url().optional().nullable(),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().min(1).max(150).optional(),
    phone: z.string().max(30).optional().nullable(),
    role: inviteableRoles.optional(),
    imageUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export const inviteUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  role: inviteableRoles,
  fullName: z.string().min(1).max(150).optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(150).optional(),
});

export const listInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["pending", "accepted", "revoked", "expired"]).optional(),
});
