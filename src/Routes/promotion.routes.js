// src/routes/promotionRoutes.js
import express from "express";
import {
  createPromoCode,
  redeemPromoCode,
  featureListing,
  getPromotions,
} from "../Controllers/promotion.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const createPromoCodeSchema = Joi.object({
  discountAmount: Joi.number().positive().required(),
  discountType: Joi.string().valid("PERCENTAGE", "FIXED").required(),
  maxUses: Joi.number().integer().positive().optional(),
  expiresAt: Joi.date().optional(),
});

const redeemPromoCodeSchema = Joi.object({
  code: Joi.string().required(),
  orderId: Joi.number().integer().required(),
});

const featureListingSchema = Joi.object({
  entityType: Joi.string().valid("GIG", "JOB").required(),
  entityId: Joi.number().integer().required(),
  durationDays: Joi.number().integer().positive().required(),
});

const getPromotionsSchema = Joi.object({
  type: Joi.string().valid("PROMO_CODE", "FEATURED_LISTING").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// All routes require authentication
router.use(authenticateToken);

router.post("/promo-code", restrictTo("ADMIN"), validateBody(createPromoCodeSchema), createPromoCode);
router.post("/redeem-promo", validateBody(redeemPromoCodeSchema), redeemPromoCode);
router.post("/feature", validateBody(featureListingSchema), featureListing);
router.get("/", validateQuery(getPromotionsSchema), getPromotions);

export default router;