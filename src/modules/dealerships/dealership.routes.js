import express from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/error-handler.js";
import { validateBody, validateQuery, paginationSchema } from "../../common/validate.js";
import {
  authenticate,
  requireRoles,
  requireTenant,
  ownerOrApiKey,
} from "../../common/auth-middleware.js";
import * as ctrl from "./dealership.controller.js";

const updateSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().min(7).max(30).optional().nullable(),
    address: z.string().max(200).optional().nullable(),
    city: z.string().min(2).max(80).optional().nullable(),
    state: z.string().length(2).optional().nullable(),
    zip: z.string().max(12).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

const router = express.Router();

router.get(
  "/me",
  authenticate,
  requireTenant,
  asyncHandler(ctrl.getMe),
);
router.patch(
  "/me",
  authenticate,
  requireTenant,
  requireRoles("owner", "manager"),
  validateBody(updateSchema),
  asyncHandler(ctrl.updateMe),
);

/** Platform owner listing */
const platformRouter = express.Router();
platformRouter.get(
  "/",
  ownerOrApiKey,
  validateQuery(paginationSchema),
  asyncHandler(ctrl.listPlatform),
);

export { platformRouter as dealershipPlatformRoutes };
export default router;
