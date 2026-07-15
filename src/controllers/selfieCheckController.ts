import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { SelfieCheck } from "../models/SelfieCheck";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// Selfie check interval — 72 hours
const SELFIE_INTERVAL_MS = 72 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
//  POST /api/driver/selfie-check
//  Driver uploads a selfie (Cloudinary URL, uploaded client-side).
// ─────────────────────────────────────────────────────────────────
export const submitSelfie = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) {
      throw new ApiError("photoUrl is required", 400);
    }

    const selfie = await SelfieCheck.create({
      driver: req.user!.userId,
      photoUrl,
      status: "pending_review",
    });

    sendSuccess(res, { selfie }, "Selfie submitted for review", 201);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/selfie-check/status
//  Check if a selfie is required right now.
// ─────────────────────────────────────────────────────────────────
export const getSelfieStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverId = req.user!.userId;

    // Find the last approved selfie
    const lastApproved = await SelfieCheck.findOne({
      driver: driverId,
      status: "approved",
    }).sort({ createdAt: -1 });

    // Find any pending selfie
    const pendingCheck = await SelfieCheck.findOne({
      driver: driverId,
      status: "pending_review",
    }).sort({ createdAt: -1 });

    const now = new Date();

    let lastCheckAt: Date | null = null;
    let nextDueAt: Date;
    let required: boolean;

    if (lastApproved) {
      lastCheckAt = lastApproved.createdAt;
      nextDueAt = new Date(lastApproved.createdAt.getTime() + SELFIE_INTERVAL_MS);
      required = now > nextDueAt && !pendingCheck;
    } else {
      // No approved selfie ever — always required unless one is pending
      nextDueAt = new Date(0); // overdue
      required = !pendingCheck;
    }

    sendSuccess(res, {
      required,
      hasPending: !!pendingCheck,
      lastCheckAt,
      nextDueAt,
    });
  } catch (error) {
    next(error);
  }
};
