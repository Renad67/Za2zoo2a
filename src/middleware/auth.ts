import { Response, NextFunction } from "express";
import { AuthRequest, JwtPayload, UserRole } from "../types";
import { verifyAccessToken } from "../utils/jwt";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_production";

/**
 * Authenticate requests using Bearer JWT token.
 */
export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * Restrict route to specific roles.
 */
export const restrictTo =
  (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ success: false, message: "Access forbidden" });
      return;
    }
    next();
  };

// Legacy aliases
export const authenticate = protect;
export const requireRole = (...roles: Array<"rider" | "driver">) =>
  restrictTo(...(roles as UserRole[]));
