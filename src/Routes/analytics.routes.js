// src/routes/analyticsRoutes.js
import express from "express";
import {
  getUserAnalytics,
  getPlatformAnalytics,
  getDetailedUserAnalytics,
} from "../Controllers/analytics.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

const detailedAnalyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  granularity: Joi.string().valid("day", "month", "year").default("month"),
});

// All routes require authentication
router.use(authenticateToken);

router.get("/user", validateQuery(analyticsQuerySchema), getUserAnalytics);
router.get("/user/detailed", validateQuery(detailedAnalyticsQuerySchema), getDetailedUserAnalytics);
router.get("/platform", restrictTo("ADMIN"), validateQuery(analyticsQuerySchema), getPlatformAnalytics);

export default router;