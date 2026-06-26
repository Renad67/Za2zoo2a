import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { Wallet } from "../models/Wallet";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/apiResponse";

// GET /api/wallet
export const getWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const wallet = await Wallet.findOne({ user: req.user!.userId });
    if (!wallet) throw new ApiError("Wallet not found", 404);
    sendSuccess(res, { wallet });
  } catch (error) {
    next(error);
  }
};

// POST /api/wallet/topup
export const topUpWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) throw new ApiError("Invalid amount", 400);

    // In production: integrate with Stripe/PayMob/Fawry here
    // For now we trust the amount directly (simulate successful payment)
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user!.userId },
      {
        $inc: { balance: amount },
        $push: {
          transactions: {
            amount,
            type: "topup",
            description: `Wallet top-up of ${amount} EGP`,
          },
        },
      },
      { new: true },
    );

    if (!wallet) throw new ApiError("Wallet not found", 404);
    sendSuccess(
      res,
      { balance: wallet.balance },
      "Wallet topped up successfully",
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/wallet/transactions
export const getTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const wallet = await Wallet.findOne({ user: req.user!.userId }).select(
      "transactions balance",
    );
    if (!wallet) throw new ApiError("Wallet not found", 404);

    const allTxns = wallet.transactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const paginated = allTxns.slice((page - 1) * limit, page * limit);

    sendSuccess(res, {
      transactions: paginated,
      balance: wallet.balance,
      pagination: { page, limit, total: allTxns.length },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/wallet/cards
export const addCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { last4, brand, expiryMonth, expiryYear, tokenId } = req.body;

    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user!.userId },
      {
        $push: {
          savedCards: {
            last4,
            brand,
            expiryMonth,
            expiryYear,
            tokenId,
            isDefault: false,
          },
        },
      },
      { new: true },
    );

    sendSuccess(res, { savedCards: wallet?.savedCards }, "Card added");
  } catch (error) {
    next(error);
  }
};

// DELETE /api/wallet/cards/:cardId
export const removeCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user!.userId },
      { $pull: { savedCards: { _id: req.params.cardId } } },
      { new: true },
    );
    sendSuccess(res, { savedCards: wallet?.savedCards }, "Card removed");
  } catch (error) {
    next(error);
  }
};

// PATCH /api/wallet/cards/:cardId/default
export const setDefaultCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Unset all defaults first
    await Wallet.findOneAndUpdate(
      { user: req.user!.userId },
      { $set: { "savedCards.$[].isDefault": false } },
    );
    // Set the chosen one
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user!.userId, "savedCards._id": req.params.cardId },
      { $set: { "savedCards.$.isDefault": true } },
      { new: true },
    );
    sendSuccess(
      res,
      { savedCards: wallet?.savedCards },
      "Default card updated",
    );
  } catch (error) {
    next(error);
  }
};
