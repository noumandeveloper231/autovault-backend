import express from "express";
import { asyncHandler } from "../../common/error-handler.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  uuidParam,
} from "../../common/validate.js";
import {
  authenticate,
  requireRoles,
  requireTenant,
  ADMIN_ROLES,
} from "../../common/auth-middleware.js";
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  inviteUserSchema,
  acceptInvitationSchema,
  listInvitationsQuerySchema,
} from "./users.schema.js";
import * as ctrl from "./users.controller.js";

const usersRouter = express.Router();

usersRouter.use(authenticate, requireTenant, requireRoles(...ADMIN_ROLES));

usersRouter.get(
  "/",
  validateQuery(listUsersQuerySchema),
  asyncHandler(ctrl.listUsers),
);
usersRouter.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(ctrl.createUser),
);
usersRouter.patch(
  "/:id",
  validateParams(uuidParam),
  validateBody(updateUserSchema),
  asyncHandler(ctrl.updateUser),
);
usersRouter.delete(
  "/:id",
  validateParams(uuidParam),
  asyncHandler(ctrl.deactivateUser),
);

const invitationsRouter = express.Router();

invitationsRouter.post(
  "/accept",
  validateBody(acceptInvitationSchema),
  asyncHandler(ctrl.acceptInvitation),
);

invitationsRouter.use(authenticate, requireTenant, requireRoles(...ADMIN_ROLES));

invitationsRouter.post(
  "/",
  validateBody(inviteUserSchema),
  asyncHandler(ctrl.inviteUser),
);
invitationsRouter.get(
  "/",
  validateQuery(listInvitationsQuerySchema),
  asyncHandler(ctrl.listInvitations),
);

export { usersRouter, invitationsRouter };
