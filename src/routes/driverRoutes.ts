import { Router } from "express";
import { body } from "express-validator";
import {
  toggleOnlineStatus,
  updateLocation,
  getEarnings,
  getBalance,
  getBonus,
  getStats,
  getDriverOwnProfile,
  getDriverPublicProfile,
  getDriverTrips,
  updateVehicle,
  updatePayoutMethod,
  saveWallet,
  saveBank,
  uploadProfilePhoto,
  editProfile,
  uploadDocument,
  getDocuments,
} from "../controllers/driverController";
import {
  getOnlineTimeToday,
  getOnlineTimeWeekly,
} from "../controllers/onlineTimeController";
import { protect, restrictTo } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadPhoto, uploadDocument as uploadDocMiddleware } from "../middleware/upload";
import { UserRole } from "../types";

const router = Router();

// All driver routes require auth + driver role
router.use(protect, restrictTo(UserRole.DRIVER));

// ── Profile ────────────────────────────────────────────────────────
router.get("/profile", getDriverOwnProfile);
router.get("/profile/:id", getDriverPublicProfile);
router.patch("/profile/me", editProfile);
router.post(
  "/profile/photo",
  uploadPhoto.single("photo"),
  uploadProfilePhoto,
);

// ── Status & Location ──────────────────────────────────────────────
router.patch(
  "/status",
  [body("isOnline").isBoolean(), validate],
  toggleOnlineStatus,
);
router.patch(
  "/location",
  [body("lat").isFloat(), body("lng").isFloat(), validate],
  updateLocation,
);

// ── Earnings, Balance, Bonus, Stats ────────────────────────────────
router.get("/earnings", getEarnings);
router.get("/balance", getBalance);
router.get("/bonus", getBonus);
router.get("/stats", getStats);

// ── Online Time ────────────────────────────────────────────────────
router.get("/online-time/today", getOnlineTimeToday);
router.get("/online-time/weekly", getOnlineTimeWeekly);

// ── Trips ──────────────────────────────────────────────────────────
router.get("/trips", getDriverTrips);

// ── Vehicle ────────────────────────────────────────────────────────
router.patch("/vehicle", updateVehicle);

// ── Payout Methods ─────────────────────────────────────────────────
router.patch("/payout-method", updatePayoutMethod);
router.patch("/wallet", saveWallet);
router.patch("/bank", saveBank);

// ── Documents ──────────────────────────────────────────────────────
router.get("/documents", getDocuments);
router.post(
  "/documents/:type",
  uploadDocMiddleware.single("document"),
  uploadDocument,
);

export default router;
