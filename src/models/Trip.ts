import { Schema, model, Document, Types } from "mongoose";
import { TripStatus } from "../types";

export interface ILocationPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface ITrip extends Document {
  _id: Types.ObjectId;
  rider: Types.ObjectId;
  driver?: Types.ObjectId;

  origin: ILocationPoint;
  destination: ILocationPoint;

  routePoints: Array<{ lat: number; lng: number }>;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;

  actualDistanceKm?: number;
  actualDurationMin?: number;

  estimatedFare: number;
  finalFare?: number;
  currency: string;

  status: TripStatus;
  requestedAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  riderRating?: number;
  driverRating?: number;
  riderComment?: string;
  driverComment?: string;

  pin: string;

  createdAt: Date;
  updatedAt: Date;
}

const LocationPointSchema = new Schema<ILocationPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: String,
  },
  { _id: false },
);

const TripSchema = new Schema<ITrip>(
  {
    rider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User" },

    origin: { type: LocationPointSchema, required: true },
    destination: { type: LocationPointSchema, required: true },

    routePoints: [
      {
        lat: Number,
        lng: Number,
        _id: false,
      },
    ],

    estimatedDistanceKm: { type: Number, required: true },
    estimatedDurationMin: { type: Number, required: true },
    actualDistanceKm: Number,
    actualDurationMin: Number,

    estimatedFare: { type: Number, required: true },
    finalFare: Number,
    currency: { type: String, default: "EGP" },

    status: {
      type: String,
      enum: Object.values(TripStatus),
      default: TripStatus.PENDING,
    },
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,

    riderRating: { type: Number, min: 1, max: 5 },
    driverRating: { type: Number, min: 1, max: 5 },
    riderComment: String,
    driverComment: String,

    pin: { type: String, required: true },
  },
  { timestamps: true },
);

TripSchema.index({ rider: 1, status: 1 });
TripSchema.index({ driver: 1, status: 1 });
TripSchema.index({ status: 1, requestedAt: -1 });

export const Trip = model<ITrip>("Trip", TripSchema);
