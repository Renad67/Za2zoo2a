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
  updateDestination,
  sendChatMessage,
  getChatMessages,
  shareTrip,
  getLiveLocation,
} from "../controllers/tripController";
import { protect, restrictTo } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../types";

const router = Router();

// ── Public (no auth) ─ live location sharing ───────────────────────
router.get("/live/:shareToken", getLiveLocation);

// All routes below require authentication
router.use(protect);

// ── Shared ──────────────────────────────────────────────────────────
router.post(
  "/estimate",
  [body("origin").notEmpty(), body("destination").notEmpty(), validate],
  estimateFare,
);

router.get("/history", getTripHistory);
router.post("/:id/cancel", cancelTrip);
router.post(
  "/:id/rate",
  [body("rating").isInt({ min: 1, max: 5 }), validate],
  rateTrip,
);

// ── Chat (rider or driver) ──────────────────────────────────────────
router.post(
  "/:id/chat",
  [body("message").trim().notEmpty().withMessage("Message is required"), validate],
  sendChatMessage,
);
router.get("/:id/chat", getChatMessages);

// ── Rider only ──────────────────────────────────────────────────────
router.post(
  "/request",
  restrictTo(UserRole.RIDER),
  [body("origin").notEmpty(), body("destination").notEmpty(), validate],
  requestTrip,
);
router.post(
  "/:id/update-destination",
  restrictTo(UserRole.RIDER),
  [body("destination").notEmpty().withMessage("New destination is required"), validate],
  updateDestination,
);
router.post("/:id/share", restrictTo(UserRole.RIDER), shareTrip);

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

// ── Dynamic Catch-all (must be at the bottom) ───────────────────────
router.get("/:id", getTripById);

export default router;
