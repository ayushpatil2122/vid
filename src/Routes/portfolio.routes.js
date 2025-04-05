import express from "express";
import { getPortfolioStats } from "../Controllers/portfolio.controller.js"; // Adjust path
import { authenticateToken } from "../Middlewares/protect.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/stats", getPortfolioStats);

export default router;