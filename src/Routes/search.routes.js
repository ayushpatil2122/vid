// src/routes/searchRoutes.js
import express from "express";
import { searchGigs, searchFreelancers } from "../Controllers/search.controller.js";
import { validateQuery } from "../Middlewares/validate.middleware.js";
import Joi from "joi";

const router = express.Router();

const searchGigsSchema = Joi.object({
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  minBudget: Joi.number().positive().optional(),
  maxBudget: Joi.number().positive().optional(),
  deliveryTime: Joi.number().integer().positive().optional(),
  rating: Joi.number().min(0).max(5).optional(),
  sortBy: Joi.string().valid("createdAt", "pricing", "deliveryTime", "freelancer.rating").default("createdAt").optional(),
  sortOrder: Joi.string().valid("asc", "desc").default("desc").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const searchFreelancersSchema = Joi.object({
  skills: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  minRate: Joi.number().positive().optional(),
  maxRate: Joi.number().positive().optional(),
  availabilityStatus: Joi.string().valid("FULL_TIME", "PART_TIME", "UNAVAILABLE").optional(),
  rating: Joi.number().min(0).max(5).optional(),
  location: Joi.string().optional(),
  search: Joi.string().optional(),
  sortBy: Joi.string().valid("rating", "createdAt", "minimumRate").default("rating").optional(),
  sortOrder: Joi.string().valid("asc", "desc").default("desc").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Public routes
router.get("/gigs", validateQuery(searchGigsSchema), searchGigs);
router.get("/freelancers", validateQuery(searchFreelancersSchema), searchFreelancers);

export default router;