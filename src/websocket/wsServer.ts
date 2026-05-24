// ─────────────────────────────────────────────────────────────────
//  src/websocket/wsServer.ts
//  Real-time driver → rider location broadcasting via WebSocket
// ─────────────────────────────────────────────────────────────────

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { WsMessage } from '../types';

// ── Connection registry ───────────────────────────────────────────
// Maps tripId → Set of WebSocket clients subscribed to that trip
const tripClients = new Map<string, Set<WebSocket>>();

// Maps userId → WebSocket (to find a specific user's socket)
const userSockets = new Map<string, WebSocket>();

// ── Setup WebSocket server ────────────────────────────────────────
export function setupWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract JWT from query: wss://host/ws?token=...
    const url    = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token  = url.searchParams.get('token');
    const tripId = url.searchParams.get('tripId');

    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }

    let userId: string;
    let role: 'rider' | 'driver';

    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      role   = payload.role;
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Register the user's socket
    userSockets.set(userId, ws);

    // Subscribe to a specific trip's broadcast channel
    if (tripId) {
      if (!tripClients.has(tripId)) tripClients.set(tripId, new Set());
      tripClients.get(tripId)!.add(ws);
    }

    console.log(`🔌  WS connected — user=${userId} role=${role} tripId=${tripId ?? 'none'}`);

    ws.on('message', async (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());

        // ── Driver sends their location ─────────────────────────
        if (msg.type === 'driver_location' && role === 'driver') {
          const { lat, lng, tripId: msgTripId } = msg;

          if (lat == null || lng == null || !msgTripId) return;

          // Persist to DB (throttled — clients send every ~5 s)
          await User.findByIdAndUpdate(userId, {
            currentLocation: { lat, lng, updatedAt: new Date() },
          });

          // Broadcast to everyone in this trip channel (rider + possibly admin)
          wsBroadcastToTrip(msgTripId, {
            type:   'driver_location',
            tripId: msgTripId,
            lat,
            lng,
          });
        }

        // ── Ping/pong keep-alive ────────────────────────────────
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Malformed JSON — ignore
      }
    });

    ws.on('close', () => {
      userSockets.delete(userId);

      // Unsubscribe from trip channel
      if (tripId) {
        tripClients.get(tripId)?.delete(ws);
        if (tripClients.get(tripId)?.size === 0) tripClients.delete(tripId);
      }

      console.log(`🔌  WS disconnected — user=${userId}`);
    });

    ws.on('error', (err) => console.error(`WS error for user=${userId}:`, err));
  });

  console.log('✅  WebSocket server ready at /ws');
  return wss;
}

// ── Helper — broadcast a message to all clients in a trip ─────────
export function wsBroadcastToTrip(tripId: string, message: WsMessage): void {
  const clients = tripClients.get(tripId);
  if (!clients) return;

  const payload = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Helper — send to a specific user ─────────────────────────────
export function wsSendToUser(userId: string, message: WsMessage): void {
  const ws = userSockets.get(userId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
