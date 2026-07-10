import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { Driver } from "../models/Driver";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { generateOtp } from "../utils/generateOtp";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";
import { UserRole, AuthRequest } from "../types";
import { sendOtpEmail, sendPasswordResetEmail } from "../services/emailService";

// POST /api/auth/register
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { fullName, email, phone, password, role, vehicle } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser)
      throw new ApiError("Email or phone already registered", 409);

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role: role || UserRole.RIDER,
      otp,
      otpExpiry,
    });

    // Create wallet for every user
    await Wallet.create({ user: user._id });

    // Create driver profile if role is driver
    if (role === UserRole.DRIVER && vehicle) {
      await Driver.create({ user: user._id, vehicle });
    }

    // Log OTP to terminal (dev fallback while email is being configured)
    console.log(`📲  OTP for ${email}: ${otp}`);

    // Send OTP via email (non-blocking — don't fail registration if email fails)
    try {
      await sendOtpEmail(email, otp, fullName);
    } catch (emailErr) {
      console.error("⚠️  Email send failed during registration, OTP saved in DB");
    }

    sendSuccess(
      res,
      { userId: user._id, message: "OTP sent to your email" },
      "Registration successful",
      201,
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-otp
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId).select("+otp +otpExpiry");
    if (!user) throw new ApiError("User not found", 404);

    if (user.otp !== otp) throw new ApiError("Invalid OTP", 400);
    if (!user.otpExpiry || user.otpExpiry < new Date())
      throw new ApiError("OTP expired", 400);

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const accessToken = signAccessToken(user._id.toString(), user.role);
    const refreshToken = signRefreshToken(user._id.toString(), user.role);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    sendSuccess(
      res,
      {
        accessToken,
        refreshToken,
        user: { _id: user._id, fullName: user.fullName, role: user.role },
      },
      "Email verified",
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) throw new ApiError("Invalid credentials", 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError("Invalid credentials", 401);

    if (!user.isVerified)
      throw new ApiError("Please verify your email first", 403);
    if (!user.isActive) throw new ApiError("Account is deactivated", 403);

    const accessToken = signAccessToken(user._id.toString(), user.role);
    const refreshToken = signRefreshToken(user._id.toString(), user.role);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    sendSuccess(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          rating: user.rating,
        },
      },
      "Login successful",
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh-token
export const refreshTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new ApiError("Refresh token required", 400);

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select("+refreshToken");
    if (!user || user.refreshToken !== token)
      throw new ApiError("Invalid refresh token", 401);

    const newAccessToken = signAccessToken(user._id.toString(), user.role);
    const newRefreshToken = signRefreshToken(user._id.toString(), user.role);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    sendSuccess(
      res,
      { accessToken: newAccessToken, refreshToken: newRefreshToken },
      "Token refreshed",
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user?.userId, {
      $unset: { refreshToken: 1 },
    });
    sendSuccess(res, null, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/resend-otp
export const resendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) throw new ApiError("User not found", 404);

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Log OTP to terminal (dev fallback)
    console.log(`📲  OTP for ${user.email}: ${otp}`);

    // Send OTP via email
    try {
      await sendOtpEmail(user.email, otp, user.fullName);
    } catch (emailErr) {
      console.error("⚠️  Email send failed during resend-otp, OTP saved in DB");
    }

    sendSuccess(res, null, "OTP resent to your email");
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError("No account found with this email", 404);

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save({ validateBeforeSave: false });

    // Log OTP to terminal (dev fallback)
    console.log(`🔑  Password reset OTP for ${user.email}: ${otp}`);

    // Send password reset OTP via email
    try {
      await sendPasswordResetEmail(user.email, otp, user.fullName);
    } catch (emailErr) {
      console.error("⚠️  Email send failed during forgot-password, OTP saved in DB");
    }

    sendSuccess(
      res,
      { userId: user._id },
      "Password reset code sent to your email",
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId, otp, newPassword } = req.body;

    const user = await User.findById(userId).select("+otp +otpExpiry");
    if (!user) throw new ApiError("User not found", 404);

    if (user.otp !== otp) throw new ApiError("Invalid OTP", 400);
    if (!user.otpExpiry || user.otpExpiry < new Date())
      throw new ApiError("OTP expired", 400);

    // Update password (will be hashed by the pre-save hook)
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    sendSuccess(res, null, "Password reset successful. You can now log in.");
  } catch (error) {
    next(error);
  }
};
