import { Response, NextFunction } from "express";
import { AuthRequest, Coordinates } from "../types";
import { geocodeAddress, reverseGeocode, getRoute } from "../services/mapService";
import { calculateFare } from "../services/pricingService";
import { sendSuccess } from "../utils/apiResponse";

export const geocode = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { address } = req.body as { address: string };
    const result = await geocodeAddress(address);
    sendSuccess(res, result);
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
    sendSuccess(res, { address });
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
    const fare = await calculateFare(
      osrmResult.distance_km,
      osrmResult.duration_min,
    );

    sendSuccess(res, {
      points: osrmResult.points,
      distance_km: osrmResult.distance_km,
      duration_min: osrmResult.duration_min,
      fare,
    });
  } catch (err) {
    next(err);
  }
};
