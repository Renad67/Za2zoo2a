import { Request } from "express";
import { Document, Types } from "mongoose";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface JwtPayload {
  userId: string;
  role: "rider" | "driver";
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type WsMessageType =
  | "driver_location"
  | "trip_accepted"
  | "trip_started"
  | "trip_completed"
  | "trip_cancelled"
  | "ping"
  | "pong";

export interface WsMessage {
  type: WsMessageType;
  tripId?: string;
  lat?: number;
  lng?: number;
  payload?: Record<string, unknown>;
}

export interface OsrmRoute {
  points: Coordinates[];
  distance_km: number;
  duration_min: number;
}

export interface GeocodedLocation {
  lat: number;
  lng: number;
  display_name: string;
}

export enum TripStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  ONGOING = "ongoing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum UserRole {
  RIDER = "rider",
  DRIVER = "driver",
}

export interface MongooseDoc extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
