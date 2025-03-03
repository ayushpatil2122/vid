// src/routes/adminRoutes.js
import express from "express";
import {
  getPlatformStats,
  moderateContent,
  manageUsers,
  resolveDisputes,
} from "../Controllers/admin.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { validateBody } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(restrictTo("ADMIN"));

const moderateContentSchema = Joi.object({
  entityType: Joi.string().valid("REVIEW", "MESSAGE").required(),
  entityId: Joi.number().integer().required(),
  action: Joi.string().valid("APPROVE", "REJECT", "DELETE").required(),
  reason: Joi.string().optional(),
});

const manageUsersSchema = Joi.object({
  userId: Joi.number().integer().required(),
  action: Joi.string().valid("BAN", "SUSPEND", "ACTIVATE", "UPDATE_ROLE").required(),
  reason: Joi.string().optional(),
  role: Joi.string().valid("FREELANCER", "CLIENT", "ADMIN").when("action", { is: "UPDATE_ROLE", then: Joi.required() }),
});

const resolveDisputesSchema = Joi.object({
  status: Joi.string().valid("OPEN", "IN_REVIEW", "RESOLVED", "CLOSED").required(),
  resolution: Joi.string().when("status", { is: Joi.string().valid("RESOLVED", "CLOSED"), then: Joi.required(), otherwise: Joi.optional() }),
});

router.get("/stats", getPlatformStats);
router.post("/moderate", validateBody(moderateContentSchema), moderateContent);
router.post("/users", validateBody(manageUsersSchema), manageUsers);
router.put("/disputes/:disputeId", validateBody(resolveDisputesSchema), resolveDisputes);

export default router;