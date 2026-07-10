import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { verifyAccessToken } from "../utils/jwt";
import { Trip } from "../models/Trip";
import { Driver } from "../models/Driver";
import { WsMessageType, TripStatus } from "../types";
import { env } from "../config/env";
import {
  notifyIdleAlert,
  notifyDriverApproaching,
} from "../services/tripNotificationService";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  tripId?: string;
  isAlive: boolean;
}

interface WsMessage {
  type: WsMessageType | string;
  tripId?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

const riderConnections = new Map<string, AuthenticatedWebSocket>();
const driverConnections = new Map<string, AuthenticatedWebSocket>();
const userSockets = new Map<string, AuthenticatedWebSocket>();

// ── Idle & Approaching Detection State ────────────────────────────
interface TripLocationState {
  lastLat: number;
  lastLng: number;
  lastMovedAt: number; // timestamp ms
  approachingNotified: boolean;
}
const tripLocationState = new Map<string, TripLocationState>();

/** Distance between two lat/lng points in meters (Haversine). */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Constants ─────────────────────────────────────────────────────
const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds
const MOVEMENT_THRESHOLD_M = 50; // must move >50m to count as "moving"
const APPROACHING_DISTANCE_M = 500; // ~2 min in city traffic

export const setupWebSocket = (server: http.Server): WebSocketServer => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Heartbeat — kill stale connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket;
      if (!ws.isAlive) {
        cleanupConnection(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, env.WS_HEARTBEAT_INTERVAL);

  // ── Idle Alert Scanner ──────────────────────────────────────────
  const idleScanner = setInterval(async () => {
    const now = Date.now();
    for (const [tripId, state] of tripLocationState.entries()) {
      const idleDuration = now - state.lastMovedAt;
      if (idleDuration >= IDLE_THRESHOLD_MS) {
        try {
          const trip = await Trip.findById(tripId).select("rider status");
          if (trip && trip.status === TripStatus.IN_PROGRESS) {
            const idleMin = Math.floor(idleDuration / 60_000);
            await notifyIdleAlert(
              trip.rider.toString(),
              tripId,
              idleMin,
            );
            // Reset timer so we don't spam — next alert in another 10 min
            state.lastMovedAt = now;
          }
        } catch (err) {
          console.error(`Idle scan error for trip ${tripId}:`, err);
        }
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(idleScanner);
  });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "No token provided");
      return;
    }

    try {
      const decoded = verifyAccessToken(token);
      ws.userId = decoded.userId;
      ws.role = decoded.role;
      userSockets.set(decoded.userId, ws);
    } catch {
      ws.close(4002, "Invalid token");
      return;
    }

    console.log(`🔌  WS connected: ${ws.userId} (${ws.role})`);

    ws.on("message", async (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        await handleMessage(ws, msg);
      } catch {
        sendToSocket(ws, { type: "error", message: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      cleanupConnection(ws);
      if (ws.userId) userSockets.delete(ws.userId);
      console.log(`🔌  WS disconnected: ${ws.userId}`);
    });

    ws.on("error", (err: Error) =>
      console.error(`WS error for ${ws.userId}:`, err.message),
    );

    sendToSocket(ws, {
      type: WsMessageType.CONNECTED,
      message: "WebSocket connection established",
    });
  });

  console.log("✅  WebSocket server ready at /ws");
  return wss;
};

// ── Message handler ──────────────────────────────────────────────

async function handleMessage(
  ws: AuthenticatedWebSocket,
  msg: WsMessage,
): Promise<void> {
  switch (msg.type) {
    case WsMessageType.PING:
      sendToSocket(ws, { type: WsMessageType.PONG });
      break;
    case "join_trip":
      await handleJoinTrip(ws, msg);
      break;
    case WsMessageType.DRIVER_LOCATION:
      await handleDriverLocation(ws, msg);
      break;
    default:
      sendToSocket(ws, {
        type: "error",
        message: `Unknown message type: ${msg.type}`,
      });
  }
}

// ── Join trip channel ────────────────────────────────────────────

async function handleJoinTrip(
  ws: AuthenticatedWebSocket,
  msg: WsMessage,
): Promise<void> {
  const { tripId } = msg;
  if (!tripId || !ws.userId) return;

  const trip = await Trip.findById(tripId);
  if (!trip) {
    sendToSocket(ws, { type: "error", message: "Trip not found" });
    return;
  }

  const isRider = trip.rider.toString() === ws.userId;
  const isDriver = trip.driver?.toString() === ws.userId;

  if (!isRider && !isDriver) {
    sendToSocket(ws, {
      type: "error",
      message: "Not authorized for this trip",
    });
    return;
  }

  ws.tripId = tripId;

  if (ws.role === "driver") {
    driverConnections.set(tripId, ws);
  } else {
    riderConnections.set(tripId, ws);
  }

  sendToSocket(ws, {
    type: WsMessageType.JOINED_TRIP,
    tripId,
    status: trip.status,
  });
}

// ── Driver location broadcast ────────────────────────────────────

async function handleDriverLocation(
  ws: AuthenticatedWebSocket,
  msg: WsMessage,
): Promise<void> {
  const { tripId, lat, lng } = msg;
  if (!tripId || lat === undefined || lng === undefined || !ws.userId) return;

  if (ws.role !== "driver") {
    sendToSocket(ws, {
      type: "error",
      message: "Only drivers can send location",
    });
    return;
  }

  // Persist to DB
  await Driver.findOneAndUpdate(
    { user: ws.userId },
    { currentLocation: { type: "Point", coordinates: [lng, lat] } },
  );

  // Append to trip location history
  Trip.findByIdAndUpdate(tripId, {
    $push: {
      driverLocationHistory: {
        coordinates: { lat, lng },
        timestamp: new Date(),
      },
    },
  }).exec();

  // ── Idle detection: track movement ──────────────────────────────
  const existing = tripLocationState.get(tripId);
  const now = Date.now();

  if (existing) {
    const distMoved = haversineMeters(existing.lastLat, existing.lastLng, lat, lng);
    if (distMoved > MOVEMENT_THRESHOLD_M) {
      existing.lastLat = lat;
      existing.lastLng = lng;
      existing.lastMovedAt = now;
    }
  } else {
    tripLocationState.set(tripId, {
      lastLat: lat,
      lastLng: lng,
      lastMovedAt: now,
      approachingNotified: false,
    });
  }

  // ── Driver approaching detection (#5) ───────────────────────────
  const trip = await Trip.findById(tripId).select("rider origin status");
  if (trip) {
    const preArrivalStatuses = [TripStatus.ACCEPTED, TripStatus.DRIVER_EN_ROUTE];
    if (preArrivalStatuses.includes(trip.status as TripStatus)) {
      const distToPickup = haversineMeters(
        lat, lng,
        trip.origin.coordinates.lat, trip.origin.coordinates.lng,
      );

      const state = tripLocationState.get(tripId);
      if (state && distToPickup <= APPROACHING_DISTANCE_M && !state.approachingNotified) {
        state.approachingNotified = true;
        const etaMinutes = Math.max(1, Math.round(distToPickup / 250)); // rough: ~250m/min in city
        notifyDriverApproaching(
          trip.rider.toString(),
          tripId,
          etaMinutes,
        ).catch((err) => console.error("Approaching notification error:", err));
      }
    }
  }

  // Forward to rider
  const riderWs = riderConnections.get(tripId);
  if (riderWs && riderWs.readyState === WebSocket.OPEN) {
    sendToSocket(riderWs, {
      type: WsMessageType.DRIVER_LOCATION,
      tripId,
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Broadcast trip status to both rider + driver ─────────────────

export const broadcastTripStatus = (
  tripId: string,
  status: TripStatus,
  extra?: Record<string, unknown>,
): void => {
  const payload = {
    type: WsMessageType.TRIP_STATUS,
    tripId,
    status,
    ...extra,
  };
  const riderWs = riderConnections.get(tripId);
  if (riderWs?.readyState === WebSocket.OPEN) sendToSocket(riderWs, payload);
  const driverWs = driverConnections.get(tripId);
  if (driverWs?.readyState === WebSocket.OPEN) sendToSocket(driverWs, payload);
};

// ── Send to a specific user by userId ────────────────────────────

export const sendToUser = (
  userId: string,
  payload: Record<string, unknown>,
): void => {
  const ws = userSockets.get(userId);
  if (ws?.readyState === WebSocket.OPEN) sendToSocket(ws, payload);
};

// ── Helpers ──────────────────────────────────────────────────────

const sendToSocket = (
  ws: WebSocket,
  data: Record<string, unknown>,
): void => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log(`📤 WS SENT: ${data.type}`, data);
    ws.send(JSON.stringify(data));
  }
};

const cleanupConnection = (ws: AuthenticatedWebSocket): void => {
  if (ws.tripId) {
    if (ws.role === "driver") driverConnections.delete(ws.tripId);
    else riderConnections.delete(ws.tripId);
    // Clean up location state when driver disconnects
    if (ws.role === "driver") tripLocationState.delete(ws.tripId);
  }
};
