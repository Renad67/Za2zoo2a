import { Response, NextFunction } from "express";
import { AuthRequest, UserRole } from "../types";
import { User } from "../models/User";
import { signAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

/**
 * POST /api/admin/auth/login
 * Admin login — rejects non-admin users with 403 even if credentials are valid.
 */
export const adminLogin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError("Email and password are required", 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) throw new ApiError("Invalid credentials", 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError("Invalid credentials", 401);

    // Reject non-admin users
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError("Access denied — admin only", 403);
    }

    const token = signAccessToken(user._id.toString(), user.role);

    sendSuccess(res, {
      token,
      admin: {
        id: user._id,
        name: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/auth/me
 * Return the current admin's profile from the JWT.
 */
export const getAdminMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select(
      "fullName email role profilePhoto",
    );
    if (!user) throw new ApiError("Admin not found", 404);

    sendSuccess(res, {
      admin: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
