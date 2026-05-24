import { Router } from "express";
import {
  setAvailability,
  updateLocation,
  getEarnings,
  getDriverProfile,
} from "../controllers/driverController";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

router.patch(
  "/availability",
  authenticate,
  requireRole("driver"),
  setAvailability,
);
router.patch("/location", authenticate, requireRole("driver"), updateLocation);
router.get("/earnings", authenticate, requireRole("driver"), getEarnings);
router.get(
  "/profile/me",
  authenticate,
  requireRole("driver"),
  getDriverProfile,
);

router.get("/profile/:id", authenticate, getDriverProfile);

export default router;
