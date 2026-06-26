import { Router } from "express";
import {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
} from "../controllers/notificationController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/", getNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markOneRead);
router.delete("/:id", deleteNotification);

export default router;
