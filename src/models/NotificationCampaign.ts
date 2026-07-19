import mongoose, { Document, Schema } from "mongoose";

export interface INotificationCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "info" | "promo" | "warning";
  target: "user" | "all_riders" | "all_drivers" | "all";
  targetUserId?: mongoose.Types.ObjectId; // Only if target === "user"
  status: "pending" | "completed" | "failed";
  sentCount: number;
  createdBy: mongoose.Types.ObjectId; // Admin
  createdAt: Date;
  updatedAt: Date;
}

const NotificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["info", "promo", "warning"],
      default: "info",
    },
    target: {
      type: String,
      enum: ["user", "all_riders", "all_drivers", "all"],
      required: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.target === "user";
      },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    sentCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

NotificationCampaignSchema.index({ createdAt: -1 });

export const NotificationCampaign = mongoose.model<INotificationCampaign>(
  "NotificationCampaign",
  NotificationCampaignSchema,
);
