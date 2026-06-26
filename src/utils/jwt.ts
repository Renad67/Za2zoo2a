import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "refresh_change_me_in_production";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";

// ── Access Token ──────────────────────────────────────────────────

export const signAccessToken = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;

// ── Refresh Token ─────────────────────────────────────────────────

export const signRefreshToken = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;

// ── Legacy aliases (backward-compat) ──────────────────────────────

export const signToken = signAccessToken;
export const verifyToken = verifyAccessToken;
