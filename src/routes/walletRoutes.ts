import { Router } from "express";
import { body } from "express-validator";
import {
  getWallet,
  topUpWallet,
  getTransactions,
  addCard,
  removeCard,
  setDefaultCard,
} from "../controllers/walletController";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(protect);

router.get("/", getWallet);
router.get("/transactions", getTransactions);
router.post(
  "/topup",
  [body("amount").isFloat({ min: 1 }), validate],
  topUpWallet,
);
router.post(
  "/cards",
  [
    body("last4").isLength({ min: 4, max: 4 }),
    body("brand").notEmpty(),
    body("expiryMonth").isInt({ min: 1, max: 12 }),
    body("expiryYear").isInt({ min: 2024 }),
    validate,
  ],
  addCard,
);
router.delete("/cards/:cardId", removeCard);
router.patch("/cards/:cardId/default", setDefaultCard);

export default router;
