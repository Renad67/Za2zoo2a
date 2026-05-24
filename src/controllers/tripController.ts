import { Response, NextFunction } from "express";
import { AuthRequest, Coordinates, TripStatus } from "../types";
import { Trip } from "../models/Trip";
import { User } from "../models/User";
import { getRoute } from "../services/mapService";
import { calculateFare, generatePin } from "../services/pricingService";
import { AppError } from "../middleware/errorHandler";
import { wsBroadcastToTrip } from "../websocket/wsServer";

export const requestTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const riderId = req.user!.userId;
    const {
      origin,
      destination,
    }: {
      origin: Coordinates & { address?: string };
      destination: Coordinates & { address?: string };
    } = req.body;

    const ongoing = await Trip.findOne({
      rider: riderId,
      status: {
        $in: [TripStatus.PENDING, TripStatus.ACCEPTED, TripStatus.ONGOING],
      },
    });
    if (ongoing) throw new AppError("You already have an active trip", 409);

    const osrm = await getRoute(origin, destination);
    const fare = calculateFare(osrm.distance_km, osrm.duration_min);

    const trip = await Trip.create({
      rider: riderId,
      origin,
      destination,
      routePoints: osrm.points,
      estimatedDistanceKm: osrm.distance_km,
      estimatedDurationMin: osrm.duration_min,
      estimatedFare: fare.totalFare,
      pin: generatePin(),
    });

    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const getAvailableTrips = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trips = await Trip.find({ status: TripStatus.PENDING })
      .populate("rider", "name phone rating profilePicture")
      .sort({ requestedAt: 1 })
      .limit(20);

    res.json({ success: true, data: trips });
  } catch (err) {
    next(err);
  }
};

export const acceptTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverId = req.user!.userId;
    const { id } = req.params;

    const driverBusy = await Trip.findOne({
      driver: driverId,
      status: { $in: [TripStatus.ACCEPTED, TripStatus.ONGOING] },
    });
    if (driverBusy) throw new AppError("You already have an active trip", 409);

    const trip = await Trip.findOneAndUpdate(
      { _id: id, status: TripStatus.PENDING },
      { driver: driverId, status: TripStatus.ACCEPTED, acceptedAt: new Date() },
      { new: true },
    ).populate("rider", "name phone");

    if (!trip) throw new AppError("Trip not found or already taken", 404);

    await User.findByIdAndUpdate(driverId, { isAvailable: false });

    wsBroadcastToTrip(String(trip._id), {
      type: "trip_accepted",
      tripId: String(trip._id),
      payload: { driverId },
    });

    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const startTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverId = req.user!.userId;
    const { id } = req.params;
    const { pin }: { pin: string } = req.body;

    const trip = await Trip.findOne({
      _id: id,
      driver: driverId,
      status: TripStatus.ACCEPTED,
    });
    if (!trip) throw new AppError("Trip not found", 404);

    if (trip.pin !== pin) throw new AppError("Invalid PIN", 400);

    trip.status = TripStatus.ONGOING;
    trip.startedAt = new Date();
    await trip.save();

    wsBroadcastToTrip(String(trip._id), {
      type: "trip_started",
      tripId: String(trip._id),
    });

    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const completeTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driverId = req.user!.userId;
    const { id } = req.params;

    const trip = await Trip.findOne({
      _id: id,
      driver: driverId,
      status: TripStatus.ONGOING,
    });
    if (!trip) throw new AppError("Trip not found", 404);

    const actualDurationMin = trip.startedAt
      ? parseFloat(
          ((Date.now() - trip.startedAt.getTime()) / 60_000).toFixed(1),
        )
      : trip.estimatedDurationMin;

    const fare = calculateFare(trip.estimatedDistanceKm, actualDurationMin);

    trip.status = TripStatus.COMPLETED;
    trip.completedAt = new Date();
    trip.actualDurationMin = actualDurationMin;
    trip.actualDistanceKm = trip.estimatedDistanceKm;
    trip.finalFare = fare.totalFare;
    await trip.save();

    await User.findByIdAndUpdate(driverId, { isAvailable: true });
    await User.findByIdAndUpdate(driverId, { $inc: { totalTrips: 1 } });
    await User.findByIdAndUpdate(trip.rider, { $inc: { totalTrips: 1 } });

    wsBroadcastToTrip(String(trip._id), {
      type: "trip_completed",
      tripId: String(trip._id),
      payload: { finalFare: fare.totalFare },
    });

    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const cancelTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;
    const { reason }: { reason?: string } = req.body;

    const query =
      role === "rider"
        ? {
            _id: id,
            rider: userId,
            status: { $in: [TripStatus.PENDING, TripStatus.ACCEPTED] },
          }
        : { _id: id, driver: userId, status: TripStatus.ACCEPTED };

    const trip = await Trip.findOneAndUpdate(
      query,
      {
        status: TripStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      { new: true },
    );

    if (!trip) throw new AppError("Trip not found or cannot be cancelled", 404);

    if (trip.driver)
      await User.findByIdAndUpdate(trip.driver, { isAvailable: true });

    wsBroadcastToTrip(String(trip._id), {
      type: "trip_cancelled",
      tripId: String(trip._id),
    });

    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const rateTrip = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const role = req.user!.role;
    const { id } = req.params;
    const { rating, comment }: { rating: number; comment?: string } = req.body;

    const trip = await Trip.findOne({ _id: id, status: TripStatus.COMPLETED });
    if (!trip) throw new AppError("Completed trip not found", 404);

    if (role === "rider") {
      trip.driverRating = rating;
      trip.driverComment = comment;

      const driver = await User.findById(trip.driver);
      if (driver) {
        const newTotal = driver.totalRatings + 1;
        driver.rating =
          (driver.rating * driver.totalRatings + rating) / newTotal;
        driver.totalRatings = newTotal;
        await driver.save();
      }
    } else {
      trip.riderRating = rating;
      trip.riderComment = comment;

      const rider = await User.findById(trip.rider);
      if (rider) {
        const newTotal = rider.totalRatings + 1;
        rider.rating = (rider.rating * rider.totalRatings + rating) / newTotal;
        rider.totalRatings = newTotal;
        await rider.save();
      }
    }

    await trip.save();
    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

export const getTripHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "10")));

    const filter = role === "rider" ? { rider: userId } : { driver: userId };

    const [trips, total] = await Promise.all([
      Trip.find({ ...filter, status: TripStatus.COMPLETED })
        .populate("rider driver", "name phone rating profilePicture")
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trip.countDocuments({ ...filter, status: TripStatus.COMPLETED }),
    ]);

    res.json({
      success: true,
      data: trips,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getTripById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await Trip.findById(req.params.id).populate(
      "rider driver",
      "name phone rating profilePicture vehicleInfo",
    );
    if (!trip) throw new AppError("Trip not found", 404);
    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};
