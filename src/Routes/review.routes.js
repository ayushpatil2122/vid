// src/routes/reviewRoutes.js
import express from "express";
import {
  createReview,
  updateReview,
  deleteReview,
  getReview,
  getFreelancerReviews,
  respondToReview,
} from "../Controllers/review.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { restrictTo } from "../Middlewares/restrict.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const createReviewSchema = Joi.object({
  orderId: Joi.number().integer().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().optional(),
  title: Joi.string().optional(),
  isAnonymous: Joi.boolean().optional(),
});

const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().optional(),
  title: Joi.string().optional(),
  isAnonymous: Joi.boolean().optional(),
}).min(1); // At least one field required

const respondReviewSchema = Joi.object({
  response: Joi.string().required(),
});

const getReviewsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Public routes
router.get("/:reviewId", getReview);
router.get("/freelancer/:freelancerId", validateQuery(getReviewsSchema), getFreelancerReviews);

// Protected routes
router.use(authenticateToken);

router.post("/", validateBody(createReviewSchema), createReview);
router.put("/:reviewId", validateBody(updateReviewSchema), updateReview);
router.delete("/:reviewId", deleteReview);
router.post("/:reviewId/respond", restrictTo("FREELANCER"), validateBody(respondReviewSchema), respondToReview);

export default router;