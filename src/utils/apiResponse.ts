import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: unknown = null,
  message = "Success",
  statusCode = 200,
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};
