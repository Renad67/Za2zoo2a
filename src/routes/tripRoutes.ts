import { Router } from "express";
import { body } from "express-validator";
import {
  estimateFare,
  requestTrip,
  getAvailableTrips,
  acceptTrip,
  driverArrived,
  verifyPin,
  startTrip,
  endTrip,
  cancelTrip,
  rateTrip,
  getTripHistory,
  getTripById,
} from "../controllers/tripController";
import { protect, restrictTo } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../types";

const router = Router();

router.use(protect);

// ── Shared ──────────────────────────────────────────────────────────
router.post(
  "/estimate",
  [body("origin").notEmpty(), body("destination").notEmpty(), validate],
  estimateFare,
);

router.get("/history", getTripHistory);
router.get("/:id", getTripById);

router.post("/:id/cancel", cancelTrip);
router.post(
  "/:id/rate",
  [body("rating").isInt({ min: 1, max: 5 }), validate],
  rateTrip,
);

// ── Rider only ──────────────────────────────────────────────────────
router.post(
  "/request",
  restrictTo(UserRole.RIDER),
  [body("origin").notEmpty(), body("destination").notEmpty(), validate],
  requestTrip,
);

// ── Driver only ─────────────────────────────────────────────────────
router.get("/available", restrictTo(UserRole.DRIVER), getAvailableTrips);
router.post("/:id/accept", restrictTo(UserRole.DRIVER), acceptTrip);
router.post("/:id/arrived", restrictTo(UserRole.DRIVER), driverArrived);
router.post(
  "/:id/verify-pin",
  restrictTo(UserRole.DRIVER),
  [body("pin").isLength({ min: 4, max: 4 }), validate],
  verifyPin,
);
router.post("/:id/start", restrictTo(UserRole.DRIVER), startTrip);
router.post("/:id/end", restrictTo(UserRole.DRIVER), endTrip);

export default router;
