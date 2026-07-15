import mongoose, { Document, Schema } from "mongoose";

export interface IPerKmTier {
  uptoKm: number | null; // null = unlimited (everything beyond the last tier)
  pricePerKm: number;
}

export interface IPricingConfig extends Document {
  _id: mongoose.Types.ObjectId;
  baseFare: number;
  perKmTiers: IPerKmTier[];
  pickupSurcharge: number;
  minFare: number;
  surgeMultiplier: number;
  waitingPerMin: number;
  cancellationFee: number;
  currency: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PerKmTierSchema = new Schema<IPerKmTier>(
  {
    uptoKm: { type: Number, default: null }, // null = ∞
    pricePerKm: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PricingConfigSchema = new Schema<IPricingConfig>(
  {
    baseFare: { type: Number, required: true, min: 0, default: 3.0 },
    perKmTiers: {
      type: [PerKmTierSchema],
      default: [
        { uptoKm: 5, pricePerKm: 1.5 },
        { uptoKm: 15, pricePerKm: 1.2 },
        { uptoKm: null, pricePerKm: 1.0 },
      ],
    },
    pickupSurcharge: { type: Number, default: 0, min: 0 },
    minFare: { type: Number, default: 10, min: 0 },
    surgeMultiplier: { type: Number, default: 1.0, min: 1.0 },
    waitingPerMin: { type: Number, default: 0.5, min: 0 },
    cancellationFee: { type: Number, default: 5, min: 0 },
    currency: { type: String, default: "EGP" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

/**
 * Singleton helper — always returns the one pricing config document,
 * creating it with defaults if none exists.
 */
PricingConfigSchema.statics.getConfig =
  async function (): Promise<IPricingConfig> {
    let config = await this.findOne();
    if (!config) {
      config = await this.create({});
    }
    return config;
  };

export interface IPricingConfigModel extends mongoose.Model<IPricingConfig> {
  getConfig(): Promise<IPricingConfig>;
}

export const PricingConfig = mongoose.model<
  IPricingConfig,
  IPricingConfigModel
>("PricingConfig", PricingConfigSchema);
