import axios from "axios";
import { Coordinates, OsrmRoute, GeocodedLocation } from "../types";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";

const http = axios.create({
  headers: { "User-Agent": "VoltRide/1.0 (contact@voltride.app)" },
  timeout: 10_000,
});

/**
 * Get driving route between two points via OSRM.
 */
export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
): Promise<OsrmRoute> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${env.OSRM_BASE_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  const { data } = await http.get(url);

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new ApiError(
      "Could not calculate route between the given points",
      422,
    );
  }

  const route = data.routes[0];

  const points: Coordinates[] = (
    route.geometry.coordinates as [number, number][]
  ).map(([lng, lat]) => ({ lat, lng }));

  return {
    points,
    distance_km: parseFloat((route.distance / 1000).toFixed(2)),
    duration_min: parseFloat((route.duration / 60).toFixed(1)),
  };
}

/**
 * Geocode an address string into coordinates.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodedLocation> {
  const { data } = await http.get(`${env.NOMINATIM_BASE_URL}/search`, {
    params: {
      q: address,
      format: "json",
      limit: 1,
      addressdetails: 1,
      countrycodes: "eg",
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new ApiError(`No location found for: "${address}"`, 404);
  }

  const first = data[0];

  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    display_name: first.display_name,
  };
}

/**
 * Reverse geocode coordinates into a readable address.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const { data } = await http.get(`${env.NOMINATIM_BASE_URL}/reverse`, {
    params: {
      lat: coords.lat,
      lon: coords.lng,
      format: "json",
    },
  });

  if (!data?.display_name) {
    throw new ApiError("Could not reverse-geocode the given coordinates", 422);
  }

  return data.display_name as string;
}
