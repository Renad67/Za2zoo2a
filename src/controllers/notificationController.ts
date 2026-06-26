import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { Notification } from "../models/Notification";
import { markAllAsRead } from "../services/notificationService";
import { sendSuccess } from "../utils/apiResponse";

// GET /api/notifications
export const getNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user: req.user!.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ user: req.user!.userId }),
      Notification.countDocuments({ user: req.user!.userId, isRead: false }),
    ]);

    sendSuccess(res, {
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await markAllAsRead(req.user!.userId);
    sendSuccess(res, null, "All notifications marked as read");
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
export const markOneRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!.userId },
      { isRead: true },
    );
    sendSuccess(res, null, "Notification marked as read");
  } catch (error) {
    next(error);
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user!.userId,
    });
    sendSuccess(res, null, "Notification deleted");
  } catch (error) {
    next(error);
  }
};
