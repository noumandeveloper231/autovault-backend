import express from "express";
import { body, query } from "express-validator";
import {
  completeRegistration,
  upsertRegistration,
} from "../controllers/registration.controller.js";
import { validate } from "../middleware/validate.js";
import { US_STATE_CODES } from "../utils/us-states.js";

const router = express.Router();

router.post(
  "/",
  [
    body("name").trim().isLength({ min: 2, max: 100 }),
    body("email").isEmail().normalizeEmail(),
    body("phone")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 7, max: 30 }),
    body("dealership").trim().isLength({ min: 2, max: 150 }),
    body("city").trim().isLength({ min: 2, max: 80 }),
    body("state")
      .trim()
      .toUpperCase()
      .isIn(US_STATE_CODES)
      .withMessage("state must be a valid US state code"),
    validate,
  ],
  upsertRegistration,
);

router.get(
  "/complete",
  [query("token").notEmpty().withMessage("token is required"), validate],
  completeRegistration,
);

export default router;
