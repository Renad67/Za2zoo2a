import mongoose, { Document, Schema } from "mongoose";
import { DriverDocumentStatus } from "../types";

export interface IDriver extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  vehicle: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
    year: number;
    seats: number;
  };
  documents: {
    drivingLicense: {
      status: DriverDocumentStatus;
      expiryDate?: Date;
      url?: string;
    };
    carLicense: {
      status: DriverDocumentStatus;
      expiryDate?: Date;
      url?: string;
      plateNumber?: string;
    };
    nationalId: { status: DriverDocumentStatus; url?: string };
    criminalRecord: { status: DriverDocumentStatus; url?: string };
    profilePhoto: { status: DriverDocumentStatus; url?: string };
  };
  earnings: {
    totalLifetime: number;
    pendingBalance: number;
    lastWithdrawal?: Date;
  };
  stats: {
    totalTrips: number;
    totalDistanceKm: number;
    totalOnlineMinutes: number;
    totalAcceptedTrips: number;
    totalOfferedTrips: number;
    totalCancelledTrips: number;
    acceptanceRate: number;
    cancellationRate: number;
    weeklyGoalMiles: number;
    weeklyGoalProgress: number;
  };
  tier: "standard" | "gold" | "platinum";
  memberSince: Date;
  nextPayoutDate?: Date;
  payoutMethod?: {
    type: "wallet" | "bank";
    walletNumber?: string;
    bankName?: string;
    iban?: string;
    swiftCode?: string;
    accountHolderName?: string;
  };
}

const DriverSchema = new Schema<IDriver>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    isOnline: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    vehicle: {
      make: { type: String, required: true },
      model: { type: String, required: true },
      color: { type: String, required: true },
      plateNumber: { type: String, required: true, unique: true },
      year: { type: Number, required: true },
      seats: { type: Number, default: 4 },
    },
    documents: {
      drivingLicense: {
        status: {
          type: String,
          enum: Object.values(DriverDocumentStatus),
          default: DriverDocumentStatus.PENDING,
        },
        expiryDate: Date,
        url: String,
      },
      carLicense: {
        status: {
          type: String,
          enum: Object.values(DriverDocumentStatus),
          default: DriverDocumentStatus.PENDING,
        },
        expiryDate: Date,
        url: String,
        plateNumber: String,
      },
      nationalId: {
        status: {
          type: String,
          enum: Object.values(DriverDocumentStatus),
          default: DriverDocumentStatus.PENDING,
        },
        url: String,
      },
      criminalRecord: {
        status: {
          type: String,
          enum: Object.values(DriverDocumentStatus),
          default: DriverDocumentStatus.PENDING,
        },
        url: String,
      },
      profilePhoto: {
        status: {
          type: String,
          enum: Object.values(DriverDocumentStatus),
          default: DriverDocumentStatus.PENDING,
        },
        url: String,
      },
    },
    earnings: {
      totalLifetime: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      lastWithdrawal: Date,
    },
    stats: {
      totalTrips: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0 },
      totalOnlineMinutes: { type: Number, default: 0 },
      totalAcceptedTrips: { type: Number, default: 0 },
      totalOfferedTrips: { type: Number, default: 0 },
      totalCancelledTrips: { type: Number, default: 0 },
      acceptanceRate: { type: Number, default: 100 },
      cancellationRate: { type: Number, default: 0 },
      weeklyGoalMiles: { type: Number, default: 500 },
      weeklyGoalProgress: { type: Number, default: 0 },
    },
    tier: {
      type: String,
      enum: ["standard", "gold", "platinum"],
      default: "standard",
    },
    memberSince: { type: Date, default: Date.now },
    nextPayoutDate: Date,
    payoutMethod: {
      type: { type: String, enum: ["wallet", "bank"] },
      walletNumber: String,
      bankName: String,
      iban: String,
      swiftCode: String,
      accountHolderName: String,
    },
  },
  { timestamps: true },
);

DriverSchema.index({ currentLocation: "2dsphere" });
DriverSchema.index({ user: 1 });
DriverSchema.index({ isOnline: 1, isAvailable: 1 });

export const Driver = mongoose.model<IDriver>("Driver", DriverSchema);
