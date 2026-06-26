import mongoose, { Document, Schema } from "mongoose";

export type TransactionType =
  | "credit"
  | "debit"
  | "refund"
  | "topup"
  | "withdrawal";

export interface IWalletTransaction {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  tripId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IWallet extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  transactions: IWalletTransaction[];
  savedCards: {
    _id?: mongoose.Types.ObjectId;
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
    tokenId: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "EGP" },
    transactions: [
      {
        amount: { type: Number, required: true },
        type: {
          type: String,
          enum: ["credit", "debit", "refund", "topup", "withdrawal"],
          required: true,
        },
        description: { type: String, required: true },
        tripId: { type: Schema.Types.ObjectId, ref: "Trip" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    savedCards: [
      {
        last4: String,
        brand: String,
        expiryMonth: Number,
        expiryYear: Number,
        isDefault: { type: Boolean, default: false },
        tokenId: { type: String, select: false },
      },
    ],
  },
  { timestamps: true },
);

WalletSchema.index({ user: 1 });

export const Wallet = mongoose.model<IWallet>("Wallet", WalletSchema);
