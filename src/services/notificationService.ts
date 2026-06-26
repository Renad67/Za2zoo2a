import { Notification } from "../models/Notification";
import { NotificationType } from "../types";
import mongoose from "mongoose";
import { sendPushNotification } from "./fcmService";

/**
 * Create an in-app notification and attempt to send a push notification.
 */
export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, unknown>,
): Promise<void> => {
  await Notification.create({
    user: new mongoose.Types.ObjectId(userId),
    title,
    body,
    type,
    data,
  });

  // Fire-and-forget push notification
  sendPushNotification(userId, title, body, data).catch((err) =>
    console.error("FCM push failed:", err),
  );
};

/**
 * Mark all notifications as read for a user.
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true } },
  );
};
