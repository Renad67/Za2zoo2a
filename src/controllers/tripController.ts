import { Response, NextFunction } from "express";
import {
  AuthRequest,
  TripStatus,
  PaymentMethod,
  NotificationType,
  WsMessageType,
} from "../types";
import { Trip } from "../models/Trip";
import { Driver } from "../models/Driver";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { getRoute, geocodeAddress, reverseGeocode } from "../services/mapService";
import { calculateFare } from "../services/pricingService";
import { generatePin } from "../utils/generateOtp";
import { createNotification } from "../services/notificationService";
import { broadcastTripStatus, sendToUser } from "../websocket/wsServer";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/estimate  — get fare estimate before booking
// ─────────────────────────────────────────────────────────────────
export const estimateFare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { origin, destination, promoCode } = req.body;

    let originCoords = origin.coordinates;
    let destCoords = destination.coordinates;

    if (!originCoords && origin.address) {
      const geo = await geocodeAddress(origin.address);
      originCoords = { lat: geo.lat, lng: geo.lng };
    }
    if (!destCoords && destination.address) {
      const geo = await geocodeAddress(destination.address);
      destCoords = { lat: geo.lat, lng: geo.lng };
    }

    const route = await getRoute(originCoords, destCoords);
    const fare = await calculateFare(
      route.distance_km,
      route.duration_min,
      1,
      promoCode,
      req.user?.userId,
    );

    sendSuccess(res, {
      fare,
      route: {
        distanceKm: route.distance_km,
        durationMin: route.duration_min,
        points: route.points,
      },
      originCoords,
      destCoords,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/request  — rider creates a trip
// ─────────────────────────────────────────────────────────────────
export const requestTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const riderId = req.user!.userId;
    const { origin, destination, paymentMethod, promoCode } = req.body;

    // Block double requests
    const activeTrip = await Trip.findOne({
      rider: riderId,
      status: {
        $in: [
          TripStatus.REQUESTED,
          TripStatus.MATCHING,
          TripStatus.ACCEPTED,
          TripStatus.DRIVER_EN_ROUTE,
          TripStatus.IN_PROGRESS,
        ],
      },
    });
    if (activeTrip) throw new ApiError("You already have an active trip", 400);

    // Resolve addresses ↔ coordinates
    let originCoords = origin.coordinates;
    let destCoords = destination.coordinates;
    let originAddress = origin.address;
    let destAddress = destination.address;

    if (!originCoords && originAddress) {
      const geo = await geocodeAddress(originAddress);
      originCoords = { lat: geo.lat, lng: geo.lng };
      originAddress = geo.display_name;
    }
    if (!originAddress && originCoords) {
      originAddress = await reverseGeocode(originCoords);
    }
    if (!destCoords && destAddress) {
      const geo = await geocodeAddress(destAddress);
      destCoords = { lat: geo.lat, lng: geo.lng };
      destAddress = geo.display_name;
    }
    if (!destAddress && destCoords) {
      destAddress = await reverseGeocode(destCoords);
    }

    const route = await getRoute(originCoords, destCoords);
    const fare = await calculateFare(
      route.distance_km,
      route.duration_min,
      1,
      promoCode,
      riderId,
    );

    const pin = generatePin();

    const trip = await Trip.create({
      rider: riderId,
      status: TripStatus.MATCHING,
      origin: { address: originAddress, coordinates: originCoords },
      destination: { address: destAddress, coordinates: destCoords },
      routePoints: route.points,
      fare: {
        baseFare: fare.baseFare,
        distanceFare: fare.distanceFare,
        timeFare: fare.timeFare,
        bookingFee: fare.bookingFee,
        discount: fare.discount,
        total: fare.total,
        surgeMultiplier: 1,
      },
      distanceKm: route.distance_km,
      estimatedDurationMin: route.duration_min,
      payment: {
        method: paymentMethod || PaymentMethod.CARD,
        status: "pending",
      },
      promoCode,
      pin,
    });

    // Notify nearby drivers (simplified — in production use 2dsphere query)
    const nearbyDrivers = await Driver.find({
      isOnline: true,
      isAvailable: true,
    })
      .select("user")
      .limit(10);

    for (const driver of nearbyDrivers) {
      // Increment offeredTrips for stats
      await Driver.findByIdAndUpdate(driver._id, {
        $inc: { "stats.totalOfferedTrips": 1 },
      });

      sendToUser(driver.user.toString(), {
        type: WsMessageType.TRIP_STATUS,
        tripId: trip._id.toString(),
        origin: trip.origin,
        destination: trip.destination,
        fare: trip.fare.total,
        distanceKm: trip.distanceKm,
        durationMin: trip.estimatedDurationMin,
      });
    }

    sendSuccess(res, { trip, pin }, "Trip requested successfully", 201);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/trips/available  — driver sees available trip requests
// ─────────────────────────────────────────────────────────────────
export const getAvailableTrips = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trips = await Trip.find({ status: TripStatus.MATCHING })
      .sort({ requestedAt: -1 })
      .limit(20)
      .populate("rider", "fullName rating profilePhoto");

    sendSuccess(res, { trips });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/accept  — driver accepts a trip
// ─────────────────────────────────────────────────────────────────
export const acceptTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverUserId = req.user!.userId;
    const trip = await Trip.findById(req.params.id);

    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.status !== TripStatus.MATCHING)
      throw new ApiError("Trip is no longer available", 400);

    const driver = await Driver.findOne({ user: driverUserId });
    if (!driver) throw new ApiError("Driver profile not found", 404);
    if (!driver.isOnline || !driver.isAvailable)
      throw new ApiError("Driver is not available", 400);

    trip.driver = driverUserId as unknown as import("mongoose").Types.ObjectId;
    trip.status = TripStatus.ACCEPTED;
    trip.acceptedAt = new Date();
    await trip.save();

    driver.isAvailable = false;
    await driver.save();

    // Update acceptance stats
    await Driver.findByIdAndUpdate(driver._id, {
      $inc: { "stats.totalAcceptedTrips": 1 },
    });

    const driverUser = await User.findById(driverUserId).select(
      "fullName rating profilePhoto",
    );

    broadcastTripStatus(trip._id.toString(), TripStatus.ACCEPTED, {
      driver: {
        name: driverUser?.fullName,
        rating: driverUser?.rating,
        photo: driverUser?.profilePhoto,
        vehicle: driver.vehicle,
      },
    });

    await createNotification(
      trip.rider.toString(),
      "Driver Found!",
      `${driverUser?.fullName} is on the way`,
      NotificationType.TRIP_UPDATE,
      { tripId: trip._id.toString() },
    );

    sendSuccess(res, { trip }, "Trip accepted");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/arrived  — driver arrived at pickup
// ─────────────────────────────────────────────────────────────────
export const driverArrived = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.driver?.toString() !== req.user!.userId)
      throw new ApiError("Unauthorized", 403);
    if (trip.status !== TripStatus.ACCEPTED)
      throw new ApiError("Invalid trip status", 400);

    trip.status = TripStatus.ARRIVED;
    await trip.save();

    broadcastTripStatus(trip._id.toString(), TripStatus.ARRIVED);

    await createNotification(
      trip.rider.toString(),
      "Driver Arrived",
      "Your driver is waiting at the pickup location",
      NotificationType.TRIP_UPDATE,
      { tripId: trip._id.toString() },
    );

    sendSuccess(res, { trip }, "Arrival confirmed");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/verify-pin  — verify rider PIN before start
// ─────────────────────────────────────────────────────────────────
export const verifyPin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { pin } = req.body;
    const trip = await Trip.findById(req.params.id).select("+pin");
    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.driver?.toString() !== req.user!.userId)
      throw new ApiError("Unauthorized", 403);

    if (trip.pin !== pin) throw new ApiError("Invalid PIN", 400);

    trip.pinVerified = true;
    await trip.save();

    sendSuccess(res, null, "PIN verified");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/start  — driver starts trip
// ─────────────────────────────────────────────────────────────────
export const startTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.driver?.toString() !== req.user!.userId)
      throw new ApiError("Unauthorized", 403);
    if (
      ![TripStatus.ARRIVED, TripStatus.ACCEPTED].includes(trip.status as TripStatus)
    )
      throw new ApiError("Invalid trip status", 400);

    trip.status = TripStatus.IN_PROGRESS;
    trip.startedAt = new Date();
    await trip.save();

    broadcastTripStatus(trip._id.toString(), TripStatus.IN_PROGRESS);

    await createNotification(
      trip.rider.toString(),
      "Trip Started",
      "Your trip is now in progress. Enjoy the ride!",
      NotificationType.TRIP_UPDATE,
      { tripId: trip._id.toString() },
    );

    sendSuccess(res, { trip }, "Trip started");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/end  — driver ends trip
// ─────────────────────────────────────────────────────────────────
export const endTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.driver?.toString() !== req.user!.userId)
      throw new ApiError("Unauthorized", 403);
    if (trip.status !== TripStatus.IN_PROGRESS)
      throw new ApiError("Trip is not in progress", 400);

    const now = new Date();
    const actualDurationMin = trip.startedAt
      ? Math.ceil((now.getTime() - trip.startedAt.getTime()) / 60000)
      : trip.estimatedDurationMin;

    trip.status = TripStatus.COMPLETED;
    trip.completedAt = now;
    trip.actualDurationMin = actualDurationMin;
    trip.payment.status = "completed" as import("../types").PaymentStatus;
    await trip.save();

    // Update driver earnings + stats
    await Driver.findOneAndUpdate(
      { user: req.user!.userId },
      {
        $inc: {
          "earnings.totalLifetime": trip.fare.total,
          "earnings.pendingBalance": trip.fare.total,
          "stats.totalTrips": 1,
          "stats.totalDistanceKm": trip.distanceKm,
        },
        isAvailable: true,
      },
    );

    // Deduct from rider wallet if wallet payment
    if (trip.payment.method === PaymentMethod.WALLET) {
      await Wallet.findOneAndUpdate(
        { user: trip.rider },
        {
          $inc: { balance: -trip.fare.total },
          $push: {
            transactions: {
              amount: trip.fare.total,
              type: "debit",
              description: `Trip to ${trip.destination.address}`,
              tripId: trip._id,
            },
          },
        },
      );
    }

    broadcastTripStatus(trip._id.toString(), TripStatus.COMPLETED, {
      fare: trip.fare,
    });

    await createNotification(
      trip.rider.toString(),
      "Trip Completed!",
      `You have arrived at ${trip.destination.address}. Total: ${trip.fare.total} EGP`,
      NotificationType.TRIP_UPDATE,
      { tripId: trip._id.toString() },
    );

    sendSuccess(res, { trip }, "Trip completed");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/cancel  — rider or driver cancels
// ─────────────────────────────────────────────────────────────────
export const cancelTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { reason } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new ApiError("Trip not found", 404);

    const isRider = trip.rider.toString() === req.user!.userId;
    const isDriver = trip.driver?.toString() === req.user!.userId;
    if (!isRider && !isDriver) throw new ApiError("Unauthorized", 403);

    const cancellableStatuses = [
      TripStatus.REQUESTED,
      TripStatus.MATCHING,
      TripStatus.ACCEPTED,
      TripStatus.DRIVER_EN_ROUTE,
      TripStatus.ARRIVED,
    ];
    if (!cancellableStatuses.includes(trip.status as TripStatus))
      throw new ApiError("Trip cannot be cancelled", 400);

    trip.status = TripStatus.CANCELLED;
    trip.cancelledAt = new Date();
    trip.cancellationReason = reason;
    trip.cancelledBy = isRider ? "rider" : "driver";
    await trip.save();

    if (trip.driver) {
      await Driver.findOneAndUpdate(
        { user: trip.driver },
        {
          isAvailable: true,
          $inc: { "stats.totalCancelledTrips": 1 },
        },
      );
    }

    broadcastTripStatus(trip._id.toString(), TripStatus.CANCELLED, { reason });

    // Notify the other party
    const notifyUserId = isRider
      ? trip.driver?.toString()
      : trip.rider.toString();
    if (notifyUserId) {
      await createNotification(
        notifyUserId,
        "Trip Cancelled",
        reason || "The trip has been cancelled",
        NotificationType.TRIP_UPDATE,
        { tripId: trip._id.toString() },
      );
    }

    sendSuccess(res, { trip }, "Trip cancelled");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  POST /api/trips/:id/rate  — rider rates driver or vice versa
// ─────────────────────────────────────────────────────────────────
export const rateTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { rating, review } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new ApiError("Trip not found", 404);
    if (trip.status !== TripStatus.COMPLETED)
      throw new ApiError("Can only rate completed trips", 400);

    const isRider = trip.rider.toString() === req.user!.userId;
    const isDriver = trip.driver?.toString() === req.user!.userId;

    if (!isRider && !isDriver) throw new ApiError("Unauthorized", 403);

    let targetUserId: string;
    if (isRider) {
      if (trip.riderRating) throw new ApiError("Already rated", 400);
      trip.riderRating = rating;
      trip.riderReview = review;
      targetUserId = trip.driver!.toString();
    } else {
      if (trip.driverRating) throw new ApiError("Already rated", 400);
      trip.driverRating = rating;
      trip.driverReview = review;
      targetUserId = trip.rider.toString();
    }
    await trip.save();

    // Update target user's average rating
    const targetUser = await User.findById(targetUserId);
    if (targetUser) {
      const newTotal = targetUser.totalRatings + 1;
      targetUser.rating = parseFloat(
        (
          (targetUser.rating * targetUser.totalRatings + rating) /
          newTotal
        ).toFixed(2),
      );
      targetUser.totalRatings = newTotal;
      await targetUser.save();
    }

    await createNotification(
      targetUserId,
      "New Rating",
      `You received a ${rating}-star rating`,
      NotificationType.RATING,
      { tripId: trip._id.toString(), rating },
    );

    sendSuccess(res, null, "Rating submitted");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/trips/history  — trip history (rider or driver)
// ─────────────────────────────────────────────────────────────────
export const getTripHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const userId = req.user!.userId;
    const role = req.user!.role;

    const query =
      role === "driver" ? { driver: userId } : { rider: userId };

    const [trips, total] = await Promise.all([
      Trip.find({ ...query, status: TripStatus.COMPLETED })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("rider", "fullName rating profilePhoto")
        .populate("driver", "fullName rating profilePhoto"),
      Trip.countDocuments({ ...query, status: TripStatus.COMPLETED }),
    ]);

    sendSuccess(res, {
      trips,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
//  GET /api/trips/:id  — get single trip
// ─────────────────────────────────────────────────────────────────
export const getTripById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("rider", "fullName rating profilePhoto phone")
      .populate("driver", "fullName rating profilePhoto phone");

    if (!trip) throw new ApiError("Trip not found", 404);

    sendSuccess(res, { trip });
  } catch (error) {
    next(error);
  }
};
