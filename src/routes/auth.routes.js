import express from "express";
import { body } from "express-validator";
import { login, me } from "../controllers/auth.controller.js";
import { portalAuth } from "../middleware/portalAuth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8, max: 128 }),
    body("portal").optional().isIn(["admin", "wholesale", "sales_rep", "sales-rep"]),
    validate,
  ],
  login,
);

router.get("/me", portalAuth, me);

export default router;
