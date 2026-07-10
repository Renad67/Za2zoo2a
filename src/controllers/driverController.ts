import { Response, NextFunction } from "express";
import { AuthRequest, TripStatus, DriverDocumentStatus } from "../types";
import { Driver } from "../models/Driver";
import { Trip } from "../models/Trip";
import { User } from "../models/User";
import { OnlineSession } from "../models/OnlineSession";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/status  — toggle online/offline
// ─────────────────────────────────────────────────────────────────
export const toggleOnlineStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { isOnline } = req.body;
    const userId = req.user!.userId;

    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError("Driver profile not found", 404);

    if (isOnline) {
      // ── Going ONLINE ──────────────────────────────────────────
      // Idempotent: only create a session if there isn't an open one
      const existingOpen = await OnlineSession.findOne({
        driver: userId,
        endedAt: null,
      });

      if (!existingOpen) {
        await OnlineSession.create({
          driver: userId,
          startedAt: new Date(),
        });
      }
    } else {
      // ── Going OFFLINE ─────────────────────────────────────────
      // Find and close the open session
      const openSession = await OnlineSession.findOne({
        driver: userId,
        endedAt: null,
      });

      if (openSession) {
        const now = new Date();
        const durationMs = now.getTime() - openSession.startedAt.getTime();

        openSession.endedAt = now;
        openSession.durationMs = durationMs;
        await openSession.save();

        // Increment the lifetime counter on Driver.stats
        const durationMin = Math.round(durationMs / 60_000);
        await Driver.findOneAndUpdate(
          { user: userId },
          { $inc: { "stats.totalOnlineMinutes": durationMin } },
        );
      }
    }

    // Update driver status flags
    driver.isOnline = isOnline;
    driver.isAvailable = isOnline;
    await driver.save();

    sendSuccess(
      res,
      { isOnline: driver.isOnline },
      `Driver is now ${isOnline ? "online" : "offline"}`,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/location  — update GPS location
// ─────────────────────────────────────────────────────────────────
export const updateLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { lat, lng }: { lat: number; lng: number } = req.body;
    await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      { currentLocation: { type: "Point", coordinates: [lng, lat] } },
    );
    sendSuccess(res, null, "Location updated");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/earnings  — earnings + weekly breakdown
// ─────────────────────────────────────────────────────────────────
export const getEarnings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId }).select(
      "earnings stats",
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    const { period = "week" } = req.query;

    // Calculate date range
    const startDate = new Date();
    if (period === "today") startDate.setHours(0, 0, 0, 0);
    else if (period === "week") startDate.setDate(startDate.getDate() - 7);
    else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
    // period === "all" → no date filter

    const dateFilter =
      period === "all" ? {} : { completedAt: { $gte: startDate } };

    // Weekly breakdown for bar chart
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyBreakdown = await Trip.aggregate([
      {
        $match: {
          driver: driver.user,
          status: TripStatus.COMPLETED,
          completedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$completedAt" },
          amount: { $sum: "$fare.total" },
          trips: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map to day names
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyData = dayNames.map((day, i) => {
      const found = weeklyBreakdown.find((w) => w._id === i + 1);
      return { day, amount: found?.amount ?? 0, trips: found?.trips ?? 0 };
    });

    // Period totals
    const periodTrips = await Trip.find({
      driver: driver.user,
      status: TripStatus.COMPLETED,
      ...dateFilter,
    });
    const totalEarnings = periodTrips.reduce(
      (sum, t) => sum + (t.fare?.total ?? 0),
      0,
    );

    sendSuccess(res, {
      period,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalTrips: periodTrips.length,
      avgFare: periodTrips.length
        ? Math.round((totalEarnings / periodTrips.length) * 100) / 100
        : 0,
      currency: "EGP",
      earnings: driver.earnings,
      weeklyBreakdown: weeklyData,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/balance  — pending balance
// ─────────────────────────────────────────────────────────────────
export const getBalance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId }).select(
      "earnings",
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    sendSuccess(res, {
      pendingBalance: driver.earnings.pendingBalance,
      totalLifetime: driver.earnings.totalLifetime,
      lastWithdrawal: driver.earnings.lastWithdrawal,
      currency: "EGP",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/bonus  — today's bonus target
// ─────────────────────────────────────────────────────────────────
export const getBonus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId }).select(
      "stats tier",
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    // Bonus target based on tier
    const bonusTargets: Record<string, { target: number; reward: number }> = {
      standard: { target: 10, reward: 50 },
      gold: { target: 15, reward: 100 },
      platinum: { target: 20, reward: 200 },
    };
    const bonus = bonusTargets[driver.tier] ?? bonusTargets.standard;

    // Count today's completed trips
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completed = await Trip.countDocuments({
      driver: driver.user,
      status: TripStatus.COMPLETED,
      completedAt: { $gte: today },
    });

    sendSuccess(res, {
      target: bonus.target,
      completed,
      reward: bonus.reward,
      currency: "EGP",
      tier: driver.tier,
      achieved: completed >= bonus.target,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/stats  — acceptance/cancellation rates, hours
// ─────────────────────────────────────────────────────────────────
export const getStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId }).select(
      "stats tier memberSince",
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    const stats = driver.stats;
    const acceptanceRate =
      stats.totalOfferedTrips > 0
        ? Math.round((stats.totalAcceptedTrips / stats.totalOfferedTrips) * 100)
        : 100;
    const cancellationRate =
      stats.totalAcceptedTrips > 0
        ? Math.round(
            (stats.totalCancelledTrips / stats.totalAcceptedTrips) * 100,
          )
        : 0;

    sendSuccess(res, {
      totalTrips: stats.totalTrips,
      totalDistanceKm: Math.round(stats.totalDistanceKm * 10) / 10,
      onlineHours: Math.round((stats.totalOnlineMinutes / 60) * 10) / 10,
      acceptanceRate,
      cancellationRate,
      weeklyGoalMiles: stats.weeklyGoalMiles,
      weeklyGoalProgress: stats.weeklyGoalProgress,
      tier: driver.tier,
      memberSince: driver.memberSince,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/profile  — own driver profile
// ─────────────────────────────────────────────────────────────────
export const getDriverOwnProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId });
    if (!driver) throw new ApiError("Driver profile not found", 404);

    const user = await User.findById(req.user!.userId).select("-password");

    sendSuccess(res, { user, driver });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/profile/:id  — public driver profile
// ─────────────────────────────────────────────────────────────────
export const getDriverPublicProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select(
      "fullName rating totalRatings profilePhoto",
    );
    if (!user) throw new ApiError("Driver not found", 404);

    const driver = await Driver.findOne({ user: req.params.id }).select(
      "-earnings -payoutMethod",
    );
    sendSuccess(res, { user, driver });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/trips  — driver trip history
// ─────────────────────────────────────────────────────────────────
export const getDriverTrips = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const [trips, total] = await Promise.all([
      Trip.find({ driver: req.user!.userId, status: TripStatus.COMPLETED })
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("rider", "fullName rating profilePhoto"),
      Trip.countDocuments({
        driver: req.user!.userId,
        status: TripStatus.COMPLETED,
      }),
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
//  PATCH /api/driver/vehicle  — update vehicle info
// ─────────────────────────────────────────────────────────────────
export const updateVehicle = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      { vehicle: req.body },
      { new: true, runValidators: true },
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);
    sendSuccess(res, { vehicle: driver.vehicle }, "Vehicle updated");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/payout-method  — set payout method (generic)
// ─────────────────────────────────────────────────────────────────
export const updatePayoutMethod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      { payoutMethod: req.body },
      { new: true },
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);
    sendSuccess(
      res,
      { payoutMethod: driver.payoutMethod },
      "Payout method updated",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/wallet  — save wallet payout number
// ─────────────────────────────────────────────────────────────────
export const saveWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { walletNumber } = req.body;
    if (!walletNumber)
      throw new ApiError("walletNumber is required", 400);

    const driver = await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      {
        payoutMethod: {
          type: "wallet",
          walletNumber,
        },
      },
      { new: true },
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    sendSuccess(
      res,
      { payoutMethod: driver.payoutMethod },
      "Wallet payout method saved",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/bank  — save bank payout details
// ─────────────────────────────────────────────────────────────────
export const saveBank = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { holderName, bankName, swift, iban } = req.body;
    if (!holderName || !bankName || !iban)
      throw new ApiError("holderName, bankName, and iban are required", 400);

    const driver = await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      {
        payoutMethod: {
          type: "bank",
          accountHolderName: holderName,
          bankName,
          swiftCode: swift,
          iban,
        },
      },
      { new: true },
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    sendSuccess(
      res,
      { payoutMethod: driver.payoutMethod },
      "Bank payout method saved",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/driver/profile/photo  — upload profile picture
// ─────────────────────────────────────────────────────────────────
export const uploadProfilePhoto = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.file) throw new ApiError("No file uploaded", 400);

    const fileUrl = `/${req.file.path.replace(/\\/g, "/")}`;

    // Update user profile photo
    await User.findByIdAndUpdate(req.user!.userId, {
      profilePhoto: fileUrl,
    });

    // Also update driver documents.profilePhoto
    await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      {
        "documents.profilePhoto": {
          status: DriverDocumentStatus.SUBMITTED,
          url: fileUrl,
        },
      },
    );

    sendSuccess(res, { url: fileUrl }, "Profile photo uploaded");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/driver/profile/me  — edit profile details
// ─────────────────────────────────────────────────────────────────
export const editProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const allowedFields = ["fullName", "email", "phone", "pushToken"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.user!.userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) throw new ApiError("User not found", 404);
    sendSuccess(res, { user }, "Profile updated");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/driver/documents/:type  — upload compliance document
// ─────────────────────────────────────────────────────────────────
const VALID_DOC_TYPES = [
  "drivingLicense",
  "carLicense",
  "nationalId",
  "criminalRecord",
] as const;

export const uploadDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { type } = req.params;

    if (!VALID_DOC_TYPES.includes(type as (typeof VALID_DOC_TYPES)[number])) {
      throw new ApiError(
        `Invalid document type. Must be one of: ${VALID_DOC_TYPES.join(", ")}`,
        400,
      );
    }

    if (!req.file) throw new ApiError("No file uploaded", 400);

    const fileUrl = `/${req.file.path.replace(/\\/g, "/")}`;

    const updateKey = `documents.${type}`;
    const updateData: Record<string, unknown> = {
      [`${updateKey}.status`]: DriverDocumentStatus.SUBMITTED,
      [`${updateKey}.url`]: fileUrl,
    };

    // Handle optional extra fields
    if (type === "drivingLicense" || type === "carLicense") {
      if (req.body.expiryDate) {
        updateData[`${updateKey}.expiryDate`] = new Date(req.body.expiryDate);
      }
    }
    if (type === "carLicense" && req.body.plateNumber) {
      updateData[`${updateKey}.plateNumber`] = req.body.plateNumber;
    }

    const driver = await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      { $set: updateData },
      { new: true },
    );

    if (!driver) throw new ApiError("Driver profile not found", 404);

    sendSuccess(
      res,
      { document: (driver.documents as Record<string, unknown>)[type] },
      `${type} uploaded successfully`,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/documents  — list all document statuses
// ─────────────────────────────────────────────────────────────────
export const getDocuments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await Driver.findOne({ user: req.user!.userId }).select(
      "documents",
    );
    if (!driver) throw new ApiError("Driver profile not found", 404);

    sendSuccess(res, { documents: driver.documents });
  } catch (error) {
    next(error);
  }
};
