import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

/**
 * Middleware that checks express-validator results and returns 400
 * with structured errors if validation failed.
 */
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: "path" in e ? e.path : "unknown",
        message: e.msg,
      })),
    });
    return;
  }

  next();
};
