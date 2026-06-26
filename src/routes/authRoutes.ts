import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  verifyOtp,
  login,
  refreshTokenHandler,
  logout,
  resendOtp,
} from "../controllers/authController";
import { validate } from "../middleware/validate";
import { protect } from "../middleware/auth";

const router = Router();

router.post(
  "/register",
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").notEmpty().withMessage("Phone is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    validate,
  ],
  register,
);

router.post(
  "/verify-otp",
  [
    body("userId").notEmpty(),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
    validate,
  ],
  verifyOtp,
);

router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty(), validate],
  login,
);

router.post(
  "/refresh-token",
  [body("refreshToken").notEmpty(), validate],
  refreshTokenHandler,
);

router.post("/logout", protect, logout);
router.post(
  "/resend-otp",
  [body("userId").notEmpty(), validate],
  resendOtp,
);

export default router;
