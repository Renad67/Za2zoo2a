import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDev = process.env.NODE_ENV === "development";
  const statusCode = "statusCode" in err ? err.statusCode : 500;

  console.error(`[ERROR] ${statusCode} — ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: err.message ?? "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};
