import express from "express";
import { body } from "express-validator";
import {
  getRegistration,
  listRegistrations,
} from "../controllers/owner.controller.js";
import { ownerLogin, ownerMe } from "../controllers/owner-auth.controller.js";
import { ownerAuth } from "../middleware/ownerAuth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/auth/login",
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8, max: 128 }), validate],
  ownerLogin,
);
router.get("/auth/me", ownerAuth, ownerMe);

router.use(ownerAuth);
router.get("/registrations", listRegistrations);
router.get("/registrations/:id", getRegistration);

export default router;
