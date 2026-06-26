import mongoose, { Document, Schema } from "mongoose";

export interface IPromoCode extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  discountPercent: number;
  maxDiscount: number;
  minFare: number;
  maxUses: number;
  usedCount: number;
  usedBy: mongoose.Types.ObjectId[];
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const PromoCodeSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    maxDiscount: { type: Number, default: 50 },
    minFare: { type: Number, default: 0 },
    maxUses: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

PromoCodeSchema.index({ code: 1 });

export const PromoCode = mongoose.model<IPromoCode>(
  "PromoCode",
  PromoCodeSchema,
);
