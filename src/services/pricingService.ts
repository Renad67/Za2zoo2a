import { env } from "../config/env";
import { FareBreakdown } from "../types";
import { PromoCode } from "../models/PromoCode";
import mongoose from "mongoose";

/**
 * Calculate fare breakdown from distance and duration.
 * Optionally applies a promo code discount.
 */
export async function calculateFare(
  distanceKm: number,
  durationMin: number,
  surgeMultiplier = 1,
  promoCode?: string,
  userId?: string | mongoose.Types.ObjectId,
): Promise<FareBreakdown> {
  const baseFare = env.BASE_FARE;
  const distanceFare = distanceKm * env.PRICE_PER_KM;
  const timeFare = durationMin * env.PRICE_PER_MIN;
  const bookingFee = env.BOOKING_FEE;

  let subtotal = (baseFare + distanceFare + timeFare) * surgeMultiplier + bookingFee;
  let discount = 0;

  // Apply promo code if provided
  if (promoCode && userId) {
    const promo = await PromoCode.findOne({
      code: promoCode.toUpperCase(),
      isActive: true,
      expiresAt: { $gte: new Date() },
    });

    if (promo && promo.usedCount < promo.maxUses) {
      const userObjectId = new mongoose.Types.ObjectId(String(userId));
      const alreadyUsed = promo.usedBy.some((id) => id.equals(userObjectId));

      if (!alreadyUsed && subtotal >= promo.minFare) {
        discount = Math.min(
          (subtotal * promo.discountPercent) / 100,
          promo.maxDiscount,
        );
      }
    }
  }

  const total = Math.max(subtotal - discount, 0);
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    baseFare: round(baseFare),
    distanceFare: round(distanceFare),
    timeFare: round(timeFare),
    bookingFee: round(bookingFee),
    discount: round(discount),
    total: round(total),
    currency: "EGP",
  };
}

/**
 * Generate a 4-digit PIN for trip verification.
 */
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
