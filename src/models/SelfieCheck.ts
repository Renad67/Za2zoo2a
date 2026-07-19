import mongoose, { Document, Schema } from "mongoose";

export interface ISelfieCheck extends Document {
  _id: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;  // ref to User (driver)
  photoUrl?: string;                // Cloudinary URL (optional for requested checks)
  status: "requested" | "pending_review" | "approved" | "rejected";
  reviewedBy?: mongoose.Types.ObjectId; // admin who reviewed
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SelfieCheckSchema = new Schema<ISelfieCheck>(
  {
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    photoUrl: { type: String }, // optional when requested by admin
    status: {
      type: String,
      enum: ["requested", "pending_review", "approved", "rejected"],
      default: "pending_review",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true },
);

SelfieCheckSchema.index({ driver: 1, createdAt: -1 });
SelfieCheckSchema.index({ status: 1 });

export const SelfieCheck = mongoose.model<ISelfieCheck>(
  "SelfieCheck",
  SelfieCheckSchema,
);
