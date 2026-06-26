import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { Driver } from "../models/Driver";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// GET /api/users/me
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) throw new ApiError("User not found", 404);
    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/me
export const updateMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const allowedFields = [
      "fullName",
      "profilePhoto",
      "savedLocations",
      "pushToken",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.user!.userId, updates, {
      new: true,
      runValidators: true,
    });
    sendSuccess(res, { user }, "Profile updated");
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/me/password
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!.userId).select("+password");
    if (!user) throw new ApiError("User not found", 404);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError("Current password is incorrect", 400);

    user.password = newPassword;
    await user.save();
    sendSuccess(res, null, "Password updated");
  } catch (error) {
    next(error);
  }
};

// POST /api/users/me/emergency-contacts
export const addEmergencyContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, relation, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $push: { emergencyContacts: { name, relation, phone } } },
      { new: true },
    );
    sendSuccess(
      res,
      { emergencyContacts: user?.emergencyContacts },
      "Contact added",
    );
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/me/emergency-contacts/:contactId
export const removeEmergencyContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $pull: { emergencyContacts: { _id: req.params.contactId } } },
      { new: true },
    );
    sendSuccess(
      res,
      { emergencyContacts: user?.emergencyContacts },
      "Contact removed",
    );
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/me  — soft delete account
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user!.userId, { isActive: false });
    sendSuccess(res, null, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};

// GET /api/users/driver/:userId  — public driver profile
export const getDriverProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select(
      "fullName rating totalRatings profilePhoto",
    );
    if (!user) throw new ApiError("Driver not found", 404);

    const driver = await Driver.findOne({ user: req.params.userId }).select(
      "-earnings -payoutMethod",
    );
    sendSuccess(res, { user, driver });
  } catch (error) {
    next(error);
  }
};
