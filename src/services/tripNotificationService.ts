import { NotificationType, WsMessageType } from "../types";
import { createNotification } from "./notificationService";
import { sendToUser } from "../websocket/wsServer";

/**
 * Unified trip notification dispatcher.
 *
 * Every function sends through TWO channels:
 *  1. WebSocket  → instant delivery when app is in foreground
 *  2. DB + FCM   → persistent notification + push for background/closed app
 */

// ─── Rider Notifications ─────────────────────────────────────────

/**
 * #1 — Ride Accepted: Driver accepted the rider's request.
 */
export async function notifyRideAccepted(
  riderId: string,
  tripId: string,
  driverInfo: {
    name: string;
    rating: number;
    photo?: string;
    vehicle: { make: string; model: string; color: string; plateNumber: string };
  },
): Promise<void> {
  // WS — instant
  sendToUser(riderId, {
    type: WsMessageType.RIDE_ACCEPTED,
    tripId,
    driver: driverInfo,
  });

  // DB + FCM — persistent
  await createNotification(
    riderId,
    "Driver Found!",
    `${driverInfo.name} is on the way in a ${driverInfo.vehicle.color} ${driverInfo.vehicle.make} ${driverInfo.vehicle.model}`,
    NotificationType.RIDE_ACCEPTED,
    { tripId, driverName: driverInfo.name, plateNumber: driverInfo.vehicle.plateNumber },
  );
}

/**
 * #2 — Driver Arrived: Driver is at the pickup location.
 */
export async function notifyDriverArrived(
  riderId: string,
  tripId: string,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.DRIVER_ARRIVED,
    tripId,
  });

  await createNotification(
    riderId,
    "Driver Arrived",
    "Your driver is waiting at the pickup location",
    NotificationType.DRIVER_ARRIVED,
    { tripId },
  );
}

/**
 * #3 — Idle Alert: Vehicle hasn't moved for > 10 minutes during a trip.
 */
export async function notifyIdleAlert(
  riderId: string,
  tripId: string,
  idleMinutes: number,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.IDLE_ALERT,
    tripId,
    idleMinutes,
  });

  await createNotification(
    riderId,
    "Safety Alert",
    `Your vehicle hasn't moved for ${idleMinutes} minutes`,
    NotificationType.IDLE_ALERT,
    { tripId, idleMinutes },
  );
}

/**
 * #4 — Driver Cancelled: Driver cancelled the active request.
 */
export async function notifyDriverCancelled(
  riderId: string,
  tripId: string,
  reason?: string,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.DRIVER_CANCELLED,
    tripId,
    reason: reason || "Driver cancelled the trip",
  });

  await createNotification(
    riderId,
    "Trip Cancelled by Driver",
    reason || "Your driver has cancelled the trip. We're finding a new one.",
    NotificationType.DRIVER_CANCELLED,
    { tripId },
  );
}

/**
 * #5 — Driver Approaching: Driver is approximately 2 minutes away.
 */
export async function notifyDriverApproaching(
  riderId: string,
  tripId: string,
  etaMinutes: number,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.DRIVER_APPROACHING,
    tripId,
    etaMinutes,
  });

  await createNotification(
    riderId,
    "Driver Approaching",
    `Your driver is about ${etaMinutes} minute${etaMinutes !== 1 ? "s" : ""} away`,
    NotificationType.DRIVER_APPROACHING,
    { tripId, etaMinutes },
  );
}

/**
 * #6 — Ride Started: Trip officially begins after PIN/OTP verification.
 */
export async function notifyRideStarted(
  riderId: string,
  tripId: string,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.RIDE_STARTED,
    tripId,
  });

  await createNotification(
    riderId,
    "Trip Started",
    "Your trip is now in progress. Enjoy the ride!",
    NotificationType.RIDE_STARTED,
    { tripId },
  );
}

/**
 * #7 — Ride Completed: Trip ended, prompt for rating + show receipt.
 */
export async function notifyRideCompleted(
  riderId: string,
  tripId: string,
  fareBreakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    discount: number;
    total: number;
  },
  destinationAddress: string,
): Promise<void> {
  sendToUser(riderId, {
    type: WsMessageType.RIDE_COMPLETED,
    tripId,
    fare: fareBreakdown,
  });

  await createNotification(
    riderId,
    "Trip Completed!",
    `You arrived at ${destinationAddress}. Total: ${fareBreakdown.total} EGP`,
    NotificationType.RIDE_COMPLETED,
    { tripId, total: fareBreakdown.total },
  );
}

// ─── Driver Notifications ─────────────────────────────────────────

/**
 * #8 — New Ride Request: A rider nearby requested a ride.
 */
export async function notifyNewRideRequest(
  driverUserId: string,
  tripSummary: {
    tripId: string;
    origin: { address: string; coordinates: { lat: number; lng: number } };
    destination: { address: string; coordinates: { lat: number; lng: number } };
    fare: number;
    distanceKm: number;
    durationMin: number;
  },
): Promise<void> {
  sendToUser(driverUserId, {
    type: WsMessageType.NEW_RIDE_REQUEST,
    ...tripSummary,
  });

  await createNotification(
    driverUserId,
    "New Ride Request",
    `Trip to ${tripSummary.destination.address} — ${tripSummary.fare} EGP`,
    NotificationType.NEW_RIDE_REQUEST,
    { tripId: tripSummary.tripId, fare: tripSummary.fare },
  );
}

/**
 * #9 — Rider Cancelled: Rider cancelled the active request.
 */
export async function notifyRiderCancelled(
  driverUserId: string,
  tripId: string,
  reason?: string,
): Promise<void> {
  sendToUser(driverUserId, {
    type: WsMessageType.RIDER_CANCELLED,
    tripId,
    reason: reason || "Rider cancelled the trip",
  });

  await createNotification(
    driverUserId,
    "Trip Cancelled by Rider",
    reason || "The rider has cancelled the trip",
    NotificationType.RIDER_CANCELLED,
    { tripId },
  );
}

/**
 * #10 — Destination Changed: Rider updated the drop-off location mid-trip.
 */
export async function notifyDestinationChanged(
  driverUserId: string,
  tripId: string,
  newDestination: { address: string; coordinates: { lat: number; lng: number } },
  newFareTotal: number,
): Promise<void> {
  sendToUser(driverUserId, {
    type: WsMessageType.DESTINATION_CHANGED,
    tripId,
    newDestination,
    newFareTotal,
  });

  await createNotification(
    driverUserId,
    "Destination Changed",
    `New drop-off: ${newDestination.address} — Updated fare: ${newFareTotal} EGP`,
    NotificationType.DESTINATION_CHANGED,
    { tripId, newAddress: newDestination.address, newFareTotal },
  );
}

/**
 * #11 — New Chat Message: In-app message from the other party.
 */
export async function notifyChatMessage(
  recipientId: string,
  senderName: string,
  message: string,
  tripId: string,
): Promise<void> {
  sendToUser(recipientId, {
    type: WsMessageType.NEW_CHAT_MESSAGE,
    tripId,
    senderName,
    message,
    sentAt: new Date().toISOString(),
  });

  await createNotification(
    recipientId,
    `Message from ${senderName}`,
    message.length > 100 ? message.substring(0, 100) + "…" : message,
    NotificationType.CHAT_MESSAGE,
    { tripId, senderName },
  );
}
