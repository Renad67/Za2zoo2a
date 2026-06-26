import { Router } from "express";
import { body } from "express-validator";
import {
  getMe,
  updateMe,
  changePassword,
  addEmergencyContact,
  removeEmergencyContact,
  deleteAccount,
  getDriverProfile,
} from "../controllers/userController";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(protect);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.delete("/me", deleteAccount);

router.patch(
  "/me/password",
  [body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 6 }), validate],
  changePassword,
);

router.post(
  "/me/emergency-contacts",
  [body("name").notEmpty(), body("phone").notEmpty(), validate],
  addEmergencyContact,
);

router.delete("/me/emergency-contacts/:contactId", removeEmergencyContact);
router.get("/driver/:userId", getDriverProfile);

export default router;
