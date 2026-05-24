import { Response, NextFunction } from "express";
import { AuthRequest, Coordinates } from "../types";
import {
  geocodeAddress,
  reverseGeocode,
  getRoute,
} from "../services/mapService";
import { calculateFare } from "../services/pricingService";

export const geocode = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { address } = req.body as { address: string };
    const result = await geocodeAddress(address);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const reverseGeocodeHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const coords = req.body as Coordinates;
    const address = await reverseGeocode(coords);
    res.json({ success: true, data: { address } });
  } catch (err) {
    next(err);
  }
};

export const route = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { origin, destination } = req.body as {
      origin: Coordinates;
      destination: Coordinates;
    };

    const osrmResult = await getRoute(origin, destination);
    const fare = calculateFare(osrmResult.distance_km, osrmResult.duration_min);

    res.json({
      success: true,
      data: {
        points: osrmResult.points,
        distance_km: osrmResult.distance_km,
        duration_min: osrmResult.duration_min,
        fare,
      },
    });
  } catch (err) {
    next(err);
  }
};
