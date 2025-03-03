// src/routes/orderRoutes.js
import express from "express";
import {
  createOrder,
  updateOrderStatus,
  getOrder,
  getClientOrders,
  getFreelancerOrders,
  cancelOrder,
} from "../Controllers/order.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { checkOwnership } from "../Middlewares/ownership.middlware.js";
import { rateLimiterByUser } from "../Middlewares/ratelimit.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", authenticateToken, rateLimiterByUser({ max: 10 }), createOrder); // User-specific rate limit  // Create a new order
router.put("/orders/:orderId/status", authenticateToken, checkOwnership("Order", "orderId", "clientId"), updateOrderStatus); // Update order status
router.get("/:orderId", getOrder);                // Get a single order
router.get("/client", getClientOrders);           // Get all orders for the client
router.get("/freelancer", restrictTo("FREELANCER"), getFreelancerOrders); // Get all orders for the freelancer
router.post("/:orderId/cancel", cancelOrder);     // Cancel an order

export default router;