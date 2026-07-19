import express from "express";
import { asyncHandler } from "../../common/error-handler.js";
import { validateBody } from "../../common/validate.js";
import { authenticate } from "../../common/auth-middleware.js";
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema.js";
import * as ctrl from "./auth.controller.js";

const v1Router = express.Router();

v1Router.post("/login", validateBody(loginSchema), asyncHandler(ctrl.loginV1));
v1Router.post("/refresh", validateBody(refreshSchema), asyncHandler(ctrl.refresh));
v1Router.post("/logout", asyncHandler(ctrl.logout));
v1Router.get("/me", authenticate, asyncHandler(ctrl.me));
v1Router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  asyncHandler(ctrl.forgotPassword),
);
v1Router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  asyncHandler(ctrl.resetPassword),
);
v1Router.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(ctrl.changePassword),
);

/** Legacy Static frontend routes (POST /api/auth/login, GET /api/auth/me) */
const legacyRouter = express.Router();

legacyRouter.post("/login", validateBody(loginSchema), asyncHandler(ctrl.login));
legacyRouter.get("/me", authenticate, asyncHandler(ctrl.meLegacy));

export { v1Router as authV1Routes, legacyRouter as authLegacyRoutes };
export default v1Router;
