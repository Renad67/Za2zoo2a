import { Router } from "express";
import {
  register,
  login,
  getMe,
  deleteAccount,
} from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMe);
router.delete("/delete-account", authenticate, deleteAccount);

export default router;
