// src/routes/transactionRoutes.js
import express from "express";
import {
  createTransaction,
  processPayment,
  refundTransaction,
  getTransaction,
  getUserTransactions,
} from "../Controllers/transaction.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const createTransactionSchema = Joi.object({
  orderId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  paymentMethodId: Joi.string().required(),
});

const refundTransactionSchema = Joi.object({
  reason: Joi.string().optional(),
});

const getTransactionsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  type: Joi.string().valid("PAYMENT", "REFUND", "PAYOUT").optional(),
});

router.use(authenticateToken);

router.post("/", validateBody(createTransactionSchema), createTransaction);
router.post("/:transactionId/process", processPayment);
router.post("/:transactionId/refund", validateBody(refundTransactionSchema), refundTransaction);
router.get("/:transactionId", getTransaction);
router.get("/", validateQuery(getTransactionsSchema), getUserTransactions);

export default router;