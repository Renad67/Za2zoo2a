import { FareBreakdown } from "../types";
import { PricingConfig, IPerKmTier } from "../models/PricingConfig";
import { PromoCode } from "../models/PromoCode";
import mongoose from "mongoose";

/**
 * Calculate distance fare using tiered per-km pricing.
 *
 * Example tiers:
 *   [{ uptoKm: 5, pricePerKm: 1.5 }, { uptoKm: 15, pricePerKm: 1.2 }, { uptoKm: null, pricePerKm: 1.0 }]
 *
 * For a 20km trip:
 *   First 5 km  → 5 × 1.5 = 7.5
 *   Next 10 km  → 10 × 1.2 = 12.0
 *   Last 5 km   → 5 × 1.0 = 5.0
 *   Total        = 24.5
 */
function calculateTieredDistance(distanceKm: number, tiers: IPerKmTier[]): number {
  let remaining = distanceKm;
  let total = 0;
  let prevLimit = 0;

  // Sort tiers by uptoKm ascending (null = ∞ goes last)
  const sorted = [...tiers].sort((a, b) => {
    if (a.uptoKm === null) return 1;
    if (b.uptoKm === null) return -1;
    return a.uptoKm - b.uptoKm;
  });

  for (const tier of sorted) {
    if (remaining <= 0) break;

    const tierRange = tier.uptoKm !== null ? tier.uptoKm - prevLimit : remaining;
    const kmInTier = Math.min(remaining, tierRange);

    total += kmInTier * tier.pricePerKm;
    remaining -= kmInTier;

    if (tier.uptoKm !== null) prevLimit = tier.uptoKm;
  }

  return total;
}

/**
 * Calculate fare breakdown from distance and duration.
 * Now reads pricing parameters from the PricingConfig collection in the database.
 * Optionally applies a promo code discount.
 */
export async function calculateFare(
  distanceKm: number,
  durationMin: number,
  surgeMultiplierOverride?: number,
  promoCode?: string,
  userId?: string | mongoose.Types.ObjectId,
): Promise<FareBreakdown> {
  const config = await PricingConfig.getConfig();

  const baseFare = config.baseFare;
  const distanceFare = calculateTieredDistance(distanceKm, config.perKmTiers);
  const timeFare = durationMin * config.waitingPerMin;
  const pickupSurcharge = config.pickupSurcharge;

  // Use DB surge by default, allow per-request override
  const surge = surgeMultiplierOverride ?? config.surgeMultiplier;

  let subtotal =
    (baseFare + distanceFare + timeFare + pickupSurcharge) * surge;

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

  // Enforce minimum fare
  const total = Math.max(subtotal - discount, config.minFare);
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    baseFare: round(baseFare),
    distanceFare: round(distanceFare),
    timeFare: round(timeFare),
    bookingFee: round(pickupSurcharge), // maps to the existing FareBreakdown field
    discount: round(discount),
    total: round(total),
    currency: config.currency,
  };
}

/**
 * Generate a 4-digit PIN for trip verification.
 */
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
