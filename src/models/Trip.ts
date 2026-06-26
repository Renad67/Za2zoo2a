import mongoose, { Document, Schema } from "mongoose";
import { TripStatus, PaymentMethod, PaymentStatus } from "../types";

export interface ITrip extends Document {
  _id: mongoose.Types.ObjectId;
  rider: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  status: TripStatus;
  origin: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  destination: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  routePoints: { lat: number; lng: number }[];
  fare: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    discount: number;
    total: number;
    surgeMultiplier: number;
  };
  distanceKm: number;
  estimatedDurationMin: number;
  actualDurationMin?: number;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId?: string;
  };
  pin?: string;
  pinVerified: boolean;
  riderRating?: number;
  driverRating?: number;
  riderReview?: string;
  driverReview?: string;
  promoCode?: string;
  driverLocationHistory: {
    coordinates: { lat: number; lng: number };
    timestamp: Date;
  }[];
  requestedAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: "rider" | "driver" | "system";
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    rider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: Object.values(TripStatus),
      default: TripStatus.REQUESTED,
    },
    origin: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    destination: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    routePoints: [{ lat: Number, lng: Number }],
    fare: {
      baseFare: { type: Number, default: 0 },
      distanceFare: { type: Number, default: 0 },
      timeFare: { type: Number, default: 0 },
      bookingFee: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      surgeMultiplier: { type: Number, default: 1 },
    },
    distanceKm: { type: Number, default: 0 },
    estimatedDurationMin: { type: Number, default: 0 },
    actualDurationMin: Number,
    payment: {
      method: {
        type: String,
        enum: Object.values(PaymentMethod),
        default: PaymentMethod.CARD,
      },
      status: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.PENDING,
      },
      transactionId: String,
    },
    pin: { type: String, select: false },
    pinVerified: { type: Boolean, default: false },
    riderRating: { type: Number, min: 1, max: 5 },
    driverRating: { type: Number, min: 1, max: 5 },
    riderReview: String,
    driverReview: String,
    promoCode: String,
    driverLocationHistory: [
      {
        coordinates: { lat: Number, lng: Number },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    cancelledBy: { type: String, enum: ["rider", "driver", "system"] },
  },
  { timestamps: true },
);

TripSchema.index({ rider: 1, status: 1 });
TripSchema.index({ driver: 1, status: 1 });
TripSchema.index({ status: 1, requestedAt: -1 });

export const Trip = mongoose.model<ITrip>("Trip", TripSchema);
