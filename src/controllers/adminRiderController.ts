import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { Trip } from "../models/Trip";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/riders
//  List riders with pagination, status filter, and search.
// ─────────────────────────────────────────────────────────────────
export const listRiders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const { status, search } = req.query;

    const query: Record<string, unknown> = { role: "rider" };

    if (status === "active") query.isActive = true;
    if (status === "blocked") query.isActive = false;

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const [riders, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    sendSuccess(res, {
      riders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/riders/:id
//  Get detailed rider info including wallet balance and trip stats.
// ─────────────────────────────────────────────────────────────────
export const getRiderDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const riderId = req.params.id;

    const rider = await User.findOne({ _id: riderId, role: "rider" }).select("-password");
    if (!rider) throw new ApiError("Rider not found", 404);

    const [wallet, tripStats] = await Promise.all([
      Wallet.findOne({ user: riderId }).select("balance currency"),
      Trip.aggregate([
        { $match: { rider: rider._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Format trip stats into a clean object
    const stats = {
      total: 0,
      completed: 0,
      cancelled: 0,
      ongoing: 0,
    };

    tripStats.forEach((stat) => {
      stats.total += stat.count;
      if (stat._id === "completed") stats.completed += stat.count;
      else if (stat._id === "cancelled") stats.cancelled += stat.count;
      else stats.ongoing += stat.count;
    });

    sendSuccess(res, {
      rider,
      wallet: wallet || { balance: 0, currency: "EGP" },
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/admin/riders/:id/block
//  Block or unblock a rider.
//  Body: { blocked: boolean }
// ─────────────────────────────────────────────────────────────────
export const blockRider = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { blocked } = req.body;
    if (typeof blocked !== "boolean") {
      throw new ApiError("blocked field must be a boolean", 400);
    }

    const rider = await User.findOneAndUpdate(
      { _id: req.params.id, role: "rider" },
      { $set: { isActive: !blocked } },
      { new: true },
    ).select("-password");

    if (!rider) throw new ApiError("Rider not found", 404);

    sendSuccess(
      res,
      { rider },
      `Rider successfully ${blocked ? "blocked" : "unblocked"}`,
    );
  } catch (error) {
    next(error);
  }
};
