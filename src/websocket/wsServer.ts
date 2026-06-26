import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { verifyAccessToken } from "../utils/jwt";
import { Trip } from "../models/Trip";
import { Driver } from "../models/Driver";
import { WsMessageType, TripStatus } from "../types";
import { env } from "../config/env";

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

  wss.on("close", () => clearInterval(heartbeat));

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
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
};

const cleanupConnection = (ws: AuthenticatedWebSocket): void => {
  if (ws.tripId) {
    if (ws.role === "driver") driverConnections.delete(ws.tripId);
    else riderConnections.delete(ws.tripId);
  }
};
