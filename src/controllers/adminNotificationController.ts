import { Response, NextFunction } from "express";
import { AuthRequest, NotificationType } from "../types";
import { User } from "../models/User";
import { NotificationCampaign } from "../models/NotificationCampaign";
import { createNotification } from "../services/notificationService";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  POST /api/admin/notifications
//  Send a notification to a specific user or bulk.
//  Body: { target: "user" | "all_riders" | "all_drivers" | "all", userId?: string, title: string, message: string, type?: "info" | "promo" | "warning" }
// ─────────────────────────────────────────────────────────────────
export const sendNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { target, userId, title, message, type = "info" } = req.body;

    if (!["user", "all_riders", "all_drivers", "all"].includes(target)) {
      throw new ApiError("Invalid target type", 400);
    }
    if (target === "user" && !userId) {
      throw new ApiError("userId is required when target is 'user'", 400);
    }
    if (!title || !message) {
      throw new ApiError("title and message are required", 400);
    }

    // 1. Create the campaign record
    const campaign = await NotificationCampaign.create({
      title,
      message,
      type,
      target,
      ...(target === "user" && { targetUserId: userId }),
      createdBy: req.user!.userId,
      status: "pending",
    });

    // 2. Resolve users based on target
    const query: Record<string, unknown> = { isActive: true };
    if (target === "user") {
      query._id = userId;
    } else if (target === "all_riders") {
      query.role = "rider";
    } else if (target === "all_drivers") {
      query.role = "driver";
    }

    const users = await User.find(query).select("_id");
    
    // 3. Dispatch notifications (fire-and-forget logic for scale, but await here for simplicity given small scale)
    // In production with millions of users, this should be sent to a queue.
    let sentCount = 0;
    
    // We map notification type to internal NotificationType enum if there's a match, otherwise system
    const mappedType = type === "promo" ? NotificationType.PROMO : NotificationType.SYSTEM;

    const notificationPromises = users.map(user => 
      createNotification(user._id.toString(), title, message, mappedType, { campaignId: campaign._id.toString() })
        .then(() => { sentCount++; })
        .catch(err => console.error(`Failed to send notification to ${user._id}:`, err))
    );

    // Wait for all to finish
    await Promise.allSettled(notificationPromises);

    // 4. Update campaign status
    campaign.status = "completed";
    campaign.sentCount = sentCount;
    await campaign.save();

    sendSuccess(
      res,
      { campaign },
      `Notification sent to ${sentCount} user(s)`,
      201,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/notifications
//  List all sent notification campaigns with pagination.
// ─────────────────────────────────────────────────────────────────
export const getNotificationHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find()
        .populate("createdBy", "fullName email")
        .populate("targetUserId", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NotificationCampaign.countDocuments(),
    ]);

    sendSuccess(res, {
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
