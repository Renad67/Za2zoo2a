export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  currency: string;
}

export function calculateFare(
  distanceKm: number,
  durationMin: number,
): FareBreakdown {
  const BASE_FARE = parseFloat(process.env.BASE_FARE ?? "5.00");
  const PRICE_PER_KM = parseFloat(process.env.PRICE_PER_KM ?? "3.50");
  const PRICE_PER_MIN = parseFloat(process.env.PRICE_PER_MIN ?? "0.50");

  const distanceFare = distanceKm * PRICE_PER_KM;
  const timeFare = durationMin * PRICE_PER_MIN;
  const totalFare = BASE_FARE + distanceFare + timeFare;

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    baseFare: round(BASE_FARE),
    distanceFare: round(distanceFare),
    timeFare: round(timeFare),
    totalFare: round(totalFare),
    currency: "EGP",
  };
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
