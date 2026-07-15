import { Response, NextFunction } from "express";
import { AuthRequest, DriverDocumentStatus } from "../types";
import { Driver } from "../models/Driver";
import { User } from "../models/User";
import { SelfieCheck } from "../models/SelfieCheck";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/drivers
//  List all drivers with filtering and pagination.
//  Query: ?status=pending|approved|blocked&page=1&limit=20
// ─────────────────────────────────────────────────────────────────
export const listDrivers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string; // pending | approved | blocked

    // Build user-level filter
    const userFilter: Record<string, unknown> = { role: "driver" };
    if (status === "blocked") {
      userFilter.isActive = false;
    }

    // Get matching user IDs
    const userIds = await User.find(userFilter).distinct("_id");

    // Build driver-level filter
    const driverFilter: Record<string, unknown> = { user: { $in: userIds } };

    if (status === "pending") {
      // At least one document is not approved
      driverFilter.$or = [
        { "documents.drivingLicense.status": { $ne: "approved" } },
        { "documents.carLicense.status": { $ne: "approved" } },
        { "documents.nationalId.status": { $ne: "approved" } },
        { "documents.criminalRecord.status": { $ne: "approved" } },
        { "documents.profilePhoto.status": { $ne: "approved" } },
      ];
    }

    const [drivers, total] = await Promise.all([
      Driver.find(driverFilter)
        .populate("user", "fullName email phone isActive isVerified createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Driver.countDocuments(driverFilter),
    ]);

    sendSuccess(res, {
      drivers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/drivers/:id
//  Full driver detail with all documents & Cloudinary URLs.
// ─────────────────────────────────────────────────────────────────
export const getDriverDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findById(req.params.id).populate(
      "user",
      "fullName email phone isActive isVerified rating totalRatings createdAt",
    );
    if (!driver) throw new ApiError("Driver not found", 404);

    // Get latest selfie
    const latestSelfie = await SelfieCheck.findOne({ driver: driver.user })
      .sort({ createdAt: -1 })
      .limit(1);

    sendSuccess(res, { driver, latestSelfie });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/admin/drivers/:id/documents/:docType/review
//  Approve or reject a specific document.
//  Body: { status: "approved" | "rejected", reason?: string }
// ─────────────────────────────────────────────────────────────────
export const reviewDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id, docType } = req.params;
    const { status, reason } = req.body;

    const validDocTypes = [
      "drivingLicense",
      "carLicense",
      "nationalId",
      "criminalRecord",
      "profilePhoto",
    ];
    if (!validDocTypes.includes(docType)) {
      throw new ApiError(
        `Invalid document type. Must be one of: ${validDocTypes.join(", ")}`,
        400,
      );
    }

    if (!["approved", "rejected"].includes(status)) {
      throw new ApiError("Status must be 'approved' or 'rejected'", 400);
    }

    if (status === "rejected" && !reason) {
      throw new ApiError("Rejection reason is required", 400);
    }

    const updatePath = `documents.${docType}.status`;
    const driver = await Driver.findByIdAndUpdate(
      id,
      { $set: { [updatePath]: status } },
      { new: true },
    ).populate("user", "fullName email");

    if (!driver) throw new ApiError("Driver not found", 404);

    sendSuccess(
      res,
      { document: (driver.documents as Record<string, unknown>)[docType] },
      `Document ${status}`,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/admin/drivers/:id/approve
//  Final approval — marks driver as verified and sets all docs to approved.
// ─────────────────────────────────────────────────────────────────
export const approveDriver = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) throw new ApiError("Driver not found", 404);

    // Set all documents to approved
    const docTypes = [
      "drivingLicense",
      "carLicense",
      "nationalId",
      "criminalRecord",
      "profilePhoto",
    ] as const;

    for (const doc of docTypes) {
      driver.documents[doc].status = DriverDocumentStatus.APPROVED;
    }
    await driver.save();

    // Mark user as verified
    await User.findByIdAndUpdate(driver.user, { isVerified: true });

    sendSuccess(res, null, "Driver approved successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/admin/drivers/:id/block
//  Block or unblock a driver.
//  Body: { blocked: boolean, reason: string, until?: Date }
// ─────────────────────────────────────────────────────────────────
export const blockDriver = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { blocked, reason } = req.body;

    if (typeof blocked !== "boolean") {
      throw new ApiError("'blocked' must be a boolean", 400);
    }
    if (blocked && !reason) {
      throw new ApiError("A reason is required when blocking a driver", 400);
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) throw new ApiError("Driver not found", 404);

    // Update user active status
    await User.findByIdAndUpdate(driver.user, { isActive: !blocked });

    // If blocking, force offline
    if (blocked) {
      driver.isOnline = false;
      driver.isAvailable = false;
      await driver.save();
    }

    sendSuccess(
      res,
      null,
      blocked ? `Driver blocked: ${reason}` : "Driver unblocked",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/selfie-checks
//  List selfies pending admin review.
//  Query: ?status=pending_review|approved|rejected&page=1&limit=20
// ─────────────────────────────────────────────────────────────────
export const listSelfieChecks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string || "pending_review";

    const filter: Record<string, unknown> = {};
    if (["pending_review", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [selfies, total] = await Promise.all([
      SelfieCheck.find(filter)
        .populate("driver", "fullName email phone profilePhoto")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SelfieCheck.countDocuments(filter),
    ]);

    sendSuccess(res, {
      selfies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/admin/selfie-checks/:id/review
//  Admin approves or rejects a selfie.
//  Body: { status: "approved" | "rejected", reason?: string }
// ─────────────────────────────────────────────────────────────────
export const reviewSelfieCheck = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      throw new ApiError("Status must be 'approved' or 'rejected'", 400);
    }
    if (status === "rejected" && !reason) {
      throw new ApiError("Rejection reason is required", 400);
    }

    const selfie = await SelfieCheck.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          ...(reason && { rejectionReason: reason }),
        },
      },
      { new: true },
    );

    if (!selfie) throw new ApiError("Selfie check not found", 404);

    sendSuccess(res, { selfie }, `Selfie ${status}`);
  } catch (error) {
    next(error);
  }
};
