import { Router } from "express";
import { getPublicConfig } from "../controllers/pricingController";

const router = Router();

// GET /api/pricing/config — public, no auth required
router.get("/config", getPublicConfig);

export default router;
