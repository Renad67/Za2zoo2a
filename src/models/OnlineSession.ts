import mongoose, { Document, Schema } from "mongoose";

export interface IOnlineSession extends Document {
  _id: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId; // User._id (same ref as Driver.user)
  startedAt: Date;
  endedAt?: Date | null;
  durationMs: number; // computed on close, 0 while open
}

const OnlineSessionSchema = new Schema<IOnlineSession>(
  {
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: false }, // startedAt/endedAt are our own timestamps
);

// Fast lookup: "today's sessions for driver X", sorted newest-first
OnlineSessionSchema.index({ driver: 1, startedAt: -1 });

// Fast lookup: "find open session for driver X" (endedAt: null)
OnlineSessionSchema.index({ driver: 1, endedAt: 1 });

export const OnlineSession = mongoose.model<IOnlineSession>(
  "OnlineSession",
  OnlineSessionSchema,
);
