const toInt = (val: string | undefined, fallback: number): number =>
  val ? parseInt(val, 10) : fallback;

const toFloat = (val: string | undefined, fallback: number): number =>
  val ? parseFloat(val) : fallback;

export const env = {
  // Server
  PORT: toInt(process.env.PORT, 3000),
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb+srv://renadabdullah32_db_user:sFM6zH0BqmPrC3iD@cluster0.dxfmiun.mongodb.net/za2zoo2a",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET ?? "change_me_in_production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ?? "refresh_change_me_in_production",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",

  // External APIs
  OSRM_BASE_URL:
    process.env.OSRM_BASE_URL ?? "http://router.project-osrm.org",
  NOMINATIM_BASE_URL:
    process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org",

  // Pricing
  BASE_FARE: toFloat(process.env.BASE_FARE, 3.0),
  PRICE_PER_KM: toFloat(process.env.PRICE_PER_KM, 1.5),
  PRICE_PER_MIN: toFloat(process.env.PRICE_PER_MIN, 0.2),
  BOOKING_FEE: toFloat(process.env.BOOKING_FEE, 1.0),

  // WebSocket
  WS_HEARTBEAT_INTERVAL: toInt(process.env.WS_HEARTBEAT_INTERVAL, 30_000),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: toInt(process.env.RATE_LIMIT_WINDOW_MS, 900_000),
  RATE_LIMIT_MAX: toInt(process.env.RATE_LIMIT_MAX, 100),

  // Uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",
  MAX_FILE_SIZE_MB: toInt(process.env.MAX_FILE_SIZE_MB, 5),

  // SMTP / Email
  SMTP_HOST: process.env.SMTP_HOST ?? "smtp-relay.brevo.com",
  SMTP_PORT: toInt(process.env.SMTP_PORT, 587),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME ?? "Za2zoo2a",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL ?? "noreply@za2zoo2a.com",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
} as const;
