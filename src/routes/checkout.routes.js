import express from "express";
import { body } from "express-validator";
import { createCheckout } from "../controllers/checkout.controller.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/",
  [
    body("registrationId").isMongoId(),
    body("plan").isIn([
      "wholesaler",
      "independent_dealer",
      "growing_dealership",
    ]),
    validate,
  ],
  createCheckout,
);

export default router;
