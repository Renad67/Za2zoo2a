import mongoose, { Document, Schema } from "mongoose";

export interface IChatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  trip: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ trip: 1, createdAt: 1 });
ChatMessageSchema.index({ recipient: 1, isRead: 1 });

export const ChatMessage = mongoose.model<IChatMessage>(
  "ChatMessage",
  ChatMessageSchema,
);
