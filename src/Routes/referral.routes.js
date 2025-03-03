// src/routes/referralRoutes.js
import express from "express";
import {
  createReferral,
  redeemReferral,
  getReferralStats,
} from "../Controllers/referral.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const createReferralSchema = Joi.object({
  rewardAmount: Joi.number().positive().optional(),
});

const redeemReferralSchema = Joi.object({
  referralCode: Joi.string().required(),
});

const getReferralStatsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// All routes require authentication
router.use(authenticateToken);

router.post("/create", validateBody(createReferralSchema), createReferral);
router.post("/redeem", validateBody(redeemReferralSchema), redeemReferral);
router.get("/stats", validateQuery(getReferralStatsSchema), getReferralStats);

export default router;