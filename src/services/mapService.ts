import axios from "axios";
import { Coordinates, OsrmRoute, GeocodedLocation } from "../types";
import { AppError } from "../middleware/errorHandler";

const OSRM_BASE = process.env.OSRM_BASE_URL ?? "http://router.project-osrm.org";
const NOMINATIM_BASE =
  process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";

const http = axios.create({
  headers: { "User-Agent": "VoltRide/1.0 (contact@voltride.app)" },
  timeout: 10_000,
});

export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
): Promise<OsrmRoute> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  const { data } = await http.get(url);

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new AppError(
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

export async function geocodeAddress(
  address: string,
): Promise<GeocodedLocation> {
  const { data } = await http.get(`${NOMINATIM_BASE}/search`, {
    params: {
      q: address,
      format: "json",
      limit: 1,
      addressdetails: 1,
      countrycodes: "eg",
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError(`No location found for: "${address}"`, 404);
  }

  const first = data[0];

  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    display_name: first.display_name,
  };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const { data } = await http.get(`${NOMINATIM_BASE}/reverse`, {
    params: {
      lat: coords.lat,
      lon: coords.lng,
      format: "json",
    },
  });

  if (!data?.display_name) {
    throw new AppError("Could not reverse-geocode the given coordinates", 422);
  }

  return data.display_name as string;
}
