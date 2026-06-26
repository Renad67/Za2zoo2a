import { Request } from "express";
import { Document, Types } from "mongoose";

// ── Enums ─────────────────────────────────────────────────────────

export enum UserRole {
  RIDER = "rider",
  DRIVER = "driver",
}

export enum TripStatus {
  REQUESTED = "requested",
  MATCHING = "matching",
  ACCEPTED = "accepted",
  DRIVER_EN_ROUTE = "driver_en_route",
  ARRIVED = "arrived",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
  WALLET = "wallet",
}

export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export enum NotificationType {
  TRIP_UPDATE = "trip_update",
  PAYMENT = "payment",
  PROMO = "promo",
  SYSTEM = "system",
  RATING = "rating",
}

export enum DriverDocumentStatus {
  PENDING = "pending",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

export enum WsMessageType {
  // Client → Server
  PING = "ping",
  JOIN_TRIP = "join_trip",
  DRIVER_LOCATION = "driver_location",

  // Server → Client
  PONG = "pong",
  CONNECTED = "connected",
  JOINED_TRIP = "joined_trip",
  TRIP_STATUS = "trip_status",
  DRIVER_ACCEPTED = "driver_accepted",
  ERROR = "error",
}

// ── Interfaces ────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
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

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  discount: number;
  total: number;
  currency: string;
}

export interface MongooseDoc extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
