import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { Trip } from "../models/Trip";
import { TripStatus } from "../types";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/trips
//  List all trips with filtering (e.g. active vs history) and pagination.
//  Query: ?type=active|history&page=1&limit=20
// ─────────────────────────────────────────────────────────────────
export const listTrips = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type as string; // active | history

    const filter: Record<string, unknown> = {};

    if (type === "active") {
      filter.status = {
        $in: [
          TripStatus.REQUESTED,
          TripStatus.MATCHING,
          TripStatus.ACCEPTED,
          TripStatus.DRIVER_EN_ROUTE,
          TripStatus.ARRIVED,
          TripStatus.IN_PROGRESS,
        ],
      };
    } else if (type === "history") {
      filter.status = {
        $in: [TripStatus.COMPLETED, TripStatus.CANCELLED],
      };
    }

    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .populate("rider", "fullName email phone profilePhoto rating")
        .populate("driver", "fullName email phone profilePhoto rating")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Trip.countDocuments(filter),
    ]);

    sendSuccess(res, {
      trips,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/admin/trips/:id
//  Get details of a specific trip.
// ─────────────────────────────────────────────────────────────────
export const getTripDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("rider", "fullName email phone profilePhoto rating")
      .populate("driver", "fullName email phone profilePhoto rating");

    if (!trip) throw new ApiError("Trip not found", 404);

    sendSuccess(res, { trip });
  } catch (error) {
    next(error);
  }
};
