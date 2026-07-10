import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { OnlineSession } from "../models/OnlineSession";
import { Driver } from "../models/Driver";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ── Helpers ───────────────────────────────────────────────────────

/** Max duration (ms) before an open session is considered stale. */
const STALE_SESSION_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Auto-close any sessions that have been open longer than the threshold.
 * This handles the "app crashed while driver was online" edge case.
 */
async function closeStaleSessionsForDriver(
  driverUserId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SESSION_THRESHOLD_MS);

  const staleSessions = await OnlineSession.find({
    driver: driverUserId,
    endedAt: null,
    startedAt: { $lt: cutoff },
  });

  for (const session of staleSessions) {
    // Cap duration at the threshold so we don't inflate the numbers
    const endedAt = new Date(
      session.startedAt.getTime() + STALE_SESSION_THRESHOLD_MS,
    );
    session.endedAt = endedAt;
    session.durationMs = STALE_SESSION_THRESHOLD_MS;
    await session.save();
  }
}

/** Format milliseconds into "Xh Ym" */
function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/online-time/today
//  Returns total online duration for today (Home Screen)
// ─────────────────────────────────────────────────────────────────
export const getOnlineTimeToday = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Ensure the driver exists
    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError("Driver profile not found", 404);

    // Auto-close stale sessions first
    await closeStaleSessionsForDriver(userId);

    // Start of today (local server time — midnight)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const now = new Date();

    // Aggregation: sum all session durations for today.
    // For sessions still open (endedAt: null), use `now` as the end time.
    const result = await OnlineSession.aggregate([
      {
        $match: {
          driver: driver.user,
          startedAt: { $gte: startOfToday },
        },
      },
      {
        $addFields: {
          effectiveDuration: {
            $cond: {
              if: { $eq: ["$endedAt", null] },
              // Session is still open → compute live duration
              then: { $subtract: [now, "$startedAt"] },
              // Session is closed → use pre-computed duration
              else: "$durationMs",
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalMs: { $sum: "$effectiveDuration" },
          sessionCount: { $sum: 1 },
        },
      },
    ]);

    const totalMs = result.length > 0 ? result[0].totalMs : 0;
    const sessionCount = result.length > 0 ? result[0].sessionCount : 0;

    sendSuccess(res, {
      totalMs,
      totalMinutes: Math.floor(totalMs / 60_000),
      formatted: formatDuration(totalMs),
      sessionCount,
      isCurrentlyOnline: driver.isOnline,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/driver/online-time/weekly
//  Returns per-week aggregation of online time (History Screen)
//  Query param: ?weeks=12  (default 12, max 52)
// ─────────────────────────────────────────────────────────────────
export const getOnlineTimeWeekly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError("Driver profile not found", 404);

    // Auto-close stale sessions
    await closeStaleSessionsForDriver(userId);

    const weeksBack = Math.min(
      parseInt(req.query.weeks as string) || 12,
      52,
    );

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);
    startDate.setHours(0, 0, 0, 0);

    const now = new Date();

    const result = await OnlineSession.aggregate([
      {
        $match: {
          driver: driver.user,
          startedAt: { $gte: startDate },
        },
      },
      {
        $addFields: {
          effectiveDuration: {
            $cond: {
              if: { $eq: ["$endedAt", null] },
              then: { $subtract: [now, "$startedAt"] },
              else: "$durationMs",
            },
          },
        },
      },
      {
        $group: {
          _id: {
            isoWeek: { $isoWeek: "$startedAt" },
            isoYear: { $isoWeekYear: "$startedAt" },
          },
          totalMs: { $sum: "$effectiveDuration" },
          sessionCount: { $sum: 1 },
          // Keep the Monday of this ISO week for display
          weekStart: { $min: "$startedAt" },
        },
      },
      { $sort: { "_id.isoYear": -1, "_id.isoWeek": -1 } },
    ]);

    const weeks = result.map((w) => ({
      isoWeek: w._id.isoWeek,
      isoYear: w._id.isoYear,
      weekStart: w.weekStart,
      totalMs: w.totalMs,
      totalMinutes: Math.floor(w.totalMs / 60_000),
      totalHours: Math.round((w.totalMs / 3_600_000) * 10) / 10,
      formatted: formatDuration(w.totalMs),
      sessionCount: w.sessionCount,
    }));

    sendSuccess(res, { weeks, weeksRequested: weeksBack });
  } catch (error) {
    next(error);
  }
};
