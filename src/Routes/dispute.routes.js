// src/routes/disputeRoutes.js
import express from "express";
import {
  createDispute,
  updateDisputeStatus,
  getDispute,
  getUserDisputes,
  addDisputeEvidence,
  addDisputeComment,
} from "../Controllers/dispute.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import { uploadMultiple } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

const createDisputeSchema = Joi.object({
  orderId: Joi.number().integer().required(),
  reason: Joi.string().required(),
  description: Joi.string().optional(),
});

const updateDisputeStatusSchema = Joi.object({
  status: Joi.string().valid("OPEN", "IN_REVIEW", "RESOLVED", "CLOSED").required(),
  resolution: Joi.string().when("status", { is: Joi.string().valid("RESOLVED", "CLOSED"), then: Joi.required(), otherwise: Joi.optional() }),
});

const addDisputeCommentSchema = Joi.object({
  content: Joi.string().required(),
});

const getDisputesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid("OPEN", "IN_REVIEW", "RESOLVED", "CLOSED").optional(),
});

// All routes require authentication
router.use(authenticateToken);

router.post("/", validateBody(createDisputeSchema), createDispute);
router.put("/:disputeId/status", restrictTo("ADMIN"), validateBody(updateDisputeStatusSchema), updateDisputeStatus);
router.get("/:disputeId", getDispute);
router.get("/", validateQuery(getDisputesSchema), getUserDisputes);
router.post("/:disputeId/evidence", uploadMultiple("evidence", 5), addDisputeEvidence);
router.post("/:disputeId/comment", validateBody(addDisputeCommentSchema), addDisputeComment);

export default router;