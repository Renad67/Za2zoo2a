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
  requestSelfieCheck,
  listCars,
} from "../controllers/adminDriverController";
import {
  sendNotification,
  getNotificationHistory,
} from "../controllers/adminNotificationController";
import {
  listRiders,
  getRiderDetail,
  blockRider as blockRiderHandler,
} from "../controllers/adminRiderController";
import { listTrips, getTripDetail } from "../controllers/adminTripController";

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

// ── Rider Management ──────────────────────────────────────────────
router.get("/riders", requireAdmin, listRiders);
router.get("/riders/:id", requireAdmin, getRiderDetail);
router.patch("/riders/:id/block", requireAdmin, blockRiderHandler);

// ── Selfie Checks ─────────────────────────────────────────────────
router.get("/selfie-checks", requireAdmin, listSelfieChecks);
router.patch("/selfie-checks/:id/review", requireAdmin, reviewSelfieCheck);
router.post("/selfie-checks/request", requireAdmin, requestSelfieCheck);

// ── Notifications ─────────────────────────────────────────────────
router.post("/notifications", requireAdmin, sendNotification);
router.get("/notifications", requireAdmin, getNotificationHistory);

// ── Cars / Vehicles ───────────────────────────────────────────────
router.get("/cars", requireAdmin, listCars);

// ── Trips ─────────────────────────────────────────────────────────
router.get("/trips", requireAdmin, listTrips);
router.get("/trips/:id", requireAdmin, getTripDetail);

export default router;
