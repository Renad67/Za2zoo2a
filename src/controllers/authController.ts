import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Trip } from "../models/Trip";
import { signToken } from "../utils/jwt";
import { AppError } from "../middleware/errorHandler";
import { TripStatus } from "../types";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, phone, password, role, email, vehicleInfo, licenseNumber } =
      req.body;

    const existing = await User.findOne({ phone });
    if (existing) throw new AppError("Phone number already registered", 409);

    const user = await User.create({
      name,
      phone,
      email,
      password: password,
      role,
      vehicleInfo,
      licenseNumber,
    });

    const token = signToken({ userId: String(user._id), role: user.role });

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone }).select("+password");
    if (!user) throw new AppError("Invalid credentials", 401);

    const ok = await user.comparePassword(password as string);
    if (!ok) throw new AppError("Invalid credentials", 401);

    if (!user.isActive) throw new AppError("Account is deactivated", 403);

    const token = signToken({ userId: String(user._id), role: user.role });

    res.json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as { user?: { userId: string } }).user?.userId;
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as { user?: { userId: string } }).user?.userId;
    const { password }: { password: string } = req.body;

    if (!password)
      throw new AppError("Password is required to delete your account", 400);

    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    const ok = await user.comparePassword(password);
    if (!ok) throw new AppError("Incorrect password", 401);

    const activeTrip = await Trip.findOne({
      $or: [{ rider: userId }, { driver: userId }],
      status: {
        $in: [TripStatus.PENDING, TripStatus.ACCEPTED, TripStatus.ONGOING],
      },
    });
    if (activeTrip) {
      throw new AppError(
        "Cannot delete account while you have an active trip. Please complete or cancel it first.",
        409,
      );
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};
