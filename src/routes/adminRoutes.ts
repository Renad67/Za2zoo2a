import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { adminLogin, getAdminMe } from "../controllers/adminAuthController";
import {
  getAdminConfig,
  updateAdminConfig,
} from "../controllers/pricingController";
import {
  listDrivers,
  getDriverDetail,
  reviewDocument,
  approveDriver,
  blockDriver,
  listSelfieChecks,
  reviewSelfieCheck,
} from "../controllers/adminDriverController";

const router = Router();

// ── Auth (no middleware — login is public) ─────────────────────────
router.post("/auth/login", adminLogin);

// ── Auth (admin protected) ────────────────────────────────────────
router.get("/auth/me", requireAdmin, getAdminMe);

// ── Pricing ───────────────────────────────────────────────────────
router.get("/pricing", requireAdmin, getAdminConfig);
router.put("/pricing", requireAdmin, updateAdminConfig);

// ── Driver Management ─────────────────────────────────────────────
router.get("/drivers", requireAdmin, listDrivers);
router.get("/drivers/:id", requireAdmin, getDriverDetail);
router.patch("/drivers/:id/documents/:docType/review", requireAdmin, reviewDocument);
router.patch("/drivers/:id/approve", requireAdmin, approveDriver);
router.patch("/drivers/:id/block", requireAdmin, blockDriver);

// ── Selfie Checks ─────────────────────────────────────────────────
router.get("/selfie-checks", requireAdmin, listSelfieChecks);
router.patch("/selfie-checks/:id/review", requireAdmin, reviewSelfieCheck);

export default router;
