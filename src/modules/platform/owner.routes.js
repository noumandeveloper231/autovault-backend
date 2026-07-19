import express from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/error-handler.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  uuidParam,
  paginationSchema,
} from "../../common/validate.js";
import { ownerOrApiKey } from "../../common/auth-middleware.js";
import {
  ownerLoginSchema,
  ownerLogin,
  ownerMe,
  listRegistrations,
  getRegistration,
  getMetrics,
  listDealerships,
} from "./owner.controller.js";

const authRouter = express.Router();

authRouter.post(
  "/login",
  validateBody(ownerLoginSchema),
  asyncHandler(ownerLogin),
);
authRouter.get("/me", ownerOrApiKey, asyncHandler(ownerMe));

const router = express.Router();

router.use("/auth", authRouter);

const registrationsRouter = express.Router();
registrationsRouter.use(ownerOrApiKey);
registrationsRouter.get("/", asyncHandler(listRegistrations));
registrationsRouter.get(
  "/:id",
  validateParams(uuidParam),
  asyncHandler(getRegistration),
);
router.use("/registrations", registrationsRouter);

const dealershipsQuerySchema = paginationSchema.extend({
  status: z
    .enum(["pending", "active", "suspended", "canceled", "payment_failed"])
    .optional(),
  state: z.string().length(2).optional(),
});

router.get("/metrics", ownerOrApiKey, asyncHandler(getMetrics));
router.get(
  "/dealerships",
  ownerOrApiKey,
  validateQuery(dealershipsQuerySchema),
  asyncHandler(listDealerships),
);

/** v1 mount: /api/v1/platform */
export const platformV1Routes = router;

/** legacy mount: /api/owner */
export const ownerLegacyRoutes = router;

export default router;
