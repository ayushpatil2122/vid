// src/controllers/transactionController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

const createTransaction = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { orderId, amount, paymentMethodId } = req.body;

    if (!orderId || !amount || !paymentMethodId) {
      return next(new ApiError(400, "Order ID, amount, and payment method ID are required"));
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { client: true },
    });
    if (!order || order.clientId !== userId) {
      return next(new ApiError(404, "Order not found or you don’t own it"));
    }
    if (order.status !== "PENDING" && order.status !== "ACCEPTED") {
      return next(new ApiError(400, "Order must be in PENDING or ACCEPTED status to create a transaction"));
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      payment_method: paymentMethodId,
      confirmation_method: "manual",
      confirm: true,
      metadata: { orderId: order.id.toString(), userId: userId.toString() },
    });

    const transaction = await prisma.transaction.create({
      data: {
        orderId: order.id,
        userId,
        amount,
        type: "PAYMENT",
        paymentMethod: "stripe",
        status: paymentIntent.status === "succeeded" ? "COMPLETED" : "PENDING",
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return res.status(201).json(new ApiResponse(201, transaction, "Transaction created successfully"));
  } catch (error) {
    console.error("Error creating transaction:", error);
    return next(new ApiError(500, "Failed to create transaction", error.message));
  }
};

const processPayment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) },
      include: { order: true },
    });
    if (!transaction || transaction.userId !== userId) {
      return next(new ApiError(404, "Transaction not found or you don’t own it"));
    }
    if (transaction.status !== "PENDING") {
      return next(new ApiError(400, "Transaction is not in PENDING status"));
    }

    const paymentIntent = await stripe.paymentIntents.confirm(transaction.stripePaymentIntentId);
    if (paymentIntent.status === "succeeded") {
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "COMPLETED" },
      });
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: { status: "ACCEPTED", statusHistory: { create: { status: "ACCEPTED", changedBy: userId } } },
      });
      return res.status(200).json(new ApiResponse(200, updatedTransaction, "Payment processed successfully"));
    }

    return next(new ApiError(400, "Payment failed to process"));
  } catch (error) {
    console.error("Error processing payment:", error);
    return next(new ApiError(500, "Failed to process payment", error.message));
  }
};

const refundTransaction = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) },
      include: { order: true },
    });
    if (!transaction || transaction.userId !== userId) {
      return next(new ApiError(404, "Transaction not found or you don’t own it"));
    }
    if (transaction.status !== "COMPLETED") {
      return next(new ApiError(400, "Only completed transactions can be refunded"));
    }

    const refund = await stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      reason: reason || "requested_by_customer",
    });

    const updatedTransaction = await prisma.transaction.create({
      data: {
        orderId: transaction.orderId,
        userId,
        amount: -transaction.amount, // Negative amount for refund
        type: "REFUND",
        paymentMethod: "stripe",
        status: "COMPLETED",
        stripeRefundId: refund.id,
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedTransaction, "Refund processed successfully"));
  } catch (error) {
    console.error("Error refunding transaction:", error);
    return next(new ApiError(500, "Failed to refund transaction", error.message));
  }
};

const getTransaction = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) },
      include: { order: { include: { gig: true } } },
    });
    if (!transaction || transaction.userId !== userId) {
      return next(new ApiError(404, "Transaction not found or you don’t own it"));
    }

    return res.status(200).json(new ApiResponse(200, transaction, "Transaction retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving transaction:", error);
    return next(new ApiError(500, "Failed to retrieve transaction", error.message));
  }
};

const getUserTransactions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { page = 1, limit = 10, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { order: { include: { gig: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        transactions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "User transactions retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving user transactions:", error);
    return next(new ApiError(500, "Failed to retrieve user transactions", error.message));
  }
};

// ... (keep existing imports and functions)

const getEarnings = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new ApiError(401, "Unauthorized: User not authenticated");
    }
    const userId = req.user.id;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: "PAYMENT",
        status: "COMPLETED",
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    if (!transactions.length) {
      return res.status(200).json(new ApiResponse(200, [], "No earnings found"));
    }

    const earningsByMonth = transactions.reduce((acc, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : new Date(); // Fallback to now if null
      const month = createdAt.toLocaleString("default", { month: "long", year: "numeric" });
      acc[month] = (acc[month] || 0) + (tx.amount || 0); // Fallback to 0 if amount is null
      return acc;
    }, {});

    const earningsData = Object.entries(earningsByMonth).map(([month, amount], index) => ({
      id: index + 1,
      month,
      amount,
    }));

    return res.status(200).json(new ApiResponse(200, earningsData, "Earnings retrieved successfully"));
  } catch (error) {
    console.error(`Error in getEarnings for user ${req.user?.id}:`, error);
    return next(new ApiError(500, "Failed to retrieve earnings", error.stack || error.message));
  }
};

// Update export
export {
  createTransaction,
  processPayment,
  refundTransaction,
  getTransaction,
  getUserTransactions,
  getEarnings,
};