// src/routes/messageRoutes.js
import express from "express";
import {
  sendMessage,
  getMessages,
  markMessageAsRead,
  deleteMessage,
  flagMessage,
} from "../Controllers/message.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import { uploadMultiple } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

const sendMessageSchema = Joi.object({
  receiverId: Joi.number().integer().required(),
  orderId: Joi.number().integer().optional(),
  content: Joi.string().required(),
  subject: Joi.string().optional(),
  parentId: Joi.number().integer().optional(),
});

const flagMessageSchema = Joi.object({
  reason: Joi.string().optional(),
});

const getMessagesSchema = Joi.object({
  orderId: Joi.number().integer().optional(),
  receiverId: Joi.number().integer().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// All routes require authentication
router.use(authenticateToken);

router.post("/", uploadMultiple("attachments", 5), validateBody(sendMessageSchema), sendMessage);
router.get("/", validateQuery(getMessagesSchema), getMessages);
router.put("/:messageId/read", markMessageAsRead);
router.delete("/:messageId", deleteMessage);
router.post("/:messageId/flag", validateBody(flagMessageSchema), flagMessage);

export default router;