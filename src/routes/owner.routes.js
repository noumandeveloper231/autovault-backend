import express from "express";
import {
  getRegistration,
  listRegistrations,
} from "../controllers/owner.controller.js";
import { ownerAuth } from "../middleware/ownerAuth.js";

const router = express.Router();

router.use(ownerAuth);
router.get("/registrations", listRegistrations);
router.get("/registrations/:id", getRegistration);

export default router;
