import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { PricingConfig } from "../models/PricingConfig";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

/**
 * GET /api/pricing/config
 * Public — riders & drivers fetch the current pricing values.
 */
export const getPublicConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const config = await PricingConfig.getConfig();
    sendSuccess(res, {
      baseFare: config.baseFare,
      perKmTiers: config.perKmTiers,
      pickupSurcharge: config.pickupSurcharge,
      minFare: config.minFare,
      surgeMultiplier: config.surgeMultiplier,
      waitingPerMin: config.waitingPerMin,
      cancellationFee: config.cancellationFee,
      currency: config.currency,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/pricing
 * Admin — view current pricing config with audit info.
 */
export const getAdminConfig = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const config = await PricingConfig.getConfig();
    sendSuccess(res, { config });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/pricing
 * Admin — update pricing config. Validates all numbers >= 0, surgeMultiplier >= 1.
 */
export const updateAdminConfig = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      baseFare,
      perKmTiers,
      pickupSurcharge,
      minFare,
      surgeMultiplier,
      waitingPerMin,
      cancellationFee,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────
    const numericFields = { baseFare, pickupSurcharge, minFare, waitingPerMin, cancellationFee };
    for (const [key, val] of Object.entries(numericFields)) {
      if (val !== undefined && (typeof val !== "number" || val < 0)) {
        throw new ApiError(`${key} must be a number >= 0`, 400);
      }
    }

    if (surgeMultiplier !== undefined) {
      if (typeof surgeMultiplier !== "number" || surgeMultiplier < 1) {
        throw new ApiError("surgeMultiplier must be a number >= 1", 400);
      }
    }

    if (perKmTiers !== undefined) {
      if (!Array.isArray(perKmTiers) || perKmTiers.length === 0) {
        throw new ApiError("perKmTiers must be a non-empty array", 400);
      }
      for (const tier of perKmTiers) {
        if (typeof tier.pricePerKm !== "number" || tier.pricePerKm < 0) {
          throw new ApiError("Each tier must have pricePerKm >= 0", 400);
        }
      }
    }

    // ── Update ──────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      updatedBy: req.user!.userId,
    };
    if (baseFare !== undefined) updatePayload.baseFare = baseFare;
    if (perKmTiers !== undefined) updatePayload.perKmTiers = perKmTiers;
    if (pickupSurcharge !== undefined) updatePayload.pickupSurcharge = pickupSurcharge;
    if (minFare !== undefined) updatePayload.minFare = minFare;
    if (surgeMultiplier !== undefined) updatePayload.surgeMultiplier = surgeMultiplier;
    if (waitingPerMin !== undefined) updatePayload.waitingPerMin = waitingPerMin;
    if (cancellationFee !== undefined) updatePayload.cancellationFee = cancellationFee;

    const config = await PricingConfig.getConfig();
    const updated = await PricingConfig.findByIdAndUpdate(
      config._id,
      { $set: updatePayload },
      { new: true, runValidators: true },
    );

    sendSuccess(res, { config: updated }, "Pricing config updated");
  } catch (error) {
    next(error);
  }
};
