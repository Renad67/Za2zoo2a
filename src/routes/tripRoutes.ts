import { Router } from "express";
import {
  requestTrip,
  getAvailableTrips,
  acceptTrip,
  startTrip,
  completeTrip,
  cancelTrip,
  rateTrip,
  getTripHistory,
  getTripById,
} from "../controllers/tripController";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/", requireRole("rider"), requestTrip);
router.get("/history", getTripHistory);
router.get("/available", requireRole("driver"), getAvailableTrips);

router.get("/:id", getTripById);
router.post("/:id/accept", requireRole("driver"), acceptTrip);
router.post("/:id/start", requireRole("driver"), startTrip);
router.post("/:id/complete", requireRole("driver"), completeTrip);
router.post("/:id/cancel", cancelTrip);
router.post("/:id/rate", rateTrip);

export default router;
