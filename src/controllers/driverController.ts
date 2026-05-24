import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { Trip } from "../models/Trip";
import { AppError } from "../middleware/errorHandler";
import { TripStatus } from "../types";

export const setAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { isAvailable }: { isAvailable: boolean } = req.body;
    const driver = await User.findByIdAndUpdate(
      req.user!.userId,
      { isAvailable },
      { new: true },
    );
    if (!driver) throw new AppError("Driver not found", 404);
    res.json({ success: true, data: { isAvailable: driver.isAvailable } });
  } catch (err) {
    next(err);
  }
};

export const updateLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { lat, lng }: { lat: number; lng: number } = req.body;
    await User.findByIdAndUpdate(req.user!.userId, {
      currentLocation: { lat, lng, updatedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getEarnings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverId = req.user!.userId;
    const { period = "week" } = req.query;

    const startDate = new Date();
    if (period === "today") startDate.setHours(0, 0, 0, 0);
    else if (period === "week") startDate.setDate(startDate.getDate() - 7);
    else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);

    const trips = await Trip.find({
      driver: driverId,
      status: TripStatus.COMPLETED,
      completedAt: { $gte: startDate },
    });

    const totalEarnings = trips.reduce((sum, t) => sum + (t.finalFare ?? 0), 0);
    const totalTrips = trips.length;
    const avgFare = totalTrips ? totalEarnings / totalTrips : 0;

    res.json({
      success: true,
      data: {
        period,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalTrips,
        avgFare: Math.round(avgFare * 100) / 100,
        currency: "EGP",
        trips,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getDriverProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id ?? req.user!.userId;

    const driver = await User.findById(targetId).select("-password");
    if (!driver || driver.role !== "driver")
      throw new AppError("Driver not found", 404);

    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
};
