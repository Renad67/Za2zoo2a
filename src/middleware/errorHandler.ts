import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDev = process.env.NODE_ENV === "development";
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  console.error(`[ERROR] ${statusCode} — ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: err.message ?? "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};
