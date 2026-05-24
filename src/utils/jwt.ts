import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export const signToken = (payload: Omit<JwtPayload, "iat" | "exp">): string =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;
