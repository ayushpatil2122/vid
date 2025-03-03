// src/routes/profileRoutes.js
import express from "express";
import {
  createFreelancerProfile,
  updateFreelancerProfile,
  getFreelancerProfile,
  deleteFreelancerProfile,
  addPortfolioVideo,
  updatePortfolioVideo,
  deletePortfolioVideo,
  getPublicFreelancerProfile,
} from "../Controllers/profile.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody } from "../Middlewares/validate.middleware.js";
import { uploadSingle } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

const profileSchema = Joi.object({
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  pinCode: Joi.string().optional(),
  jobTitle: Joi.string().required(),
  overview: Joi.string().required(),
  skills: Joi.array().items(Joi.string()).min(1).required(),
  tools: Joi.array().items(Joi.string()).optional(),
  equipmentCameras: Joi.string().optional(),
  equipmentLenses: Joi.string().optional(),
  equipmentLighting: Joi.string().optional(),
  equipmentOther: Joi.string().optional(),
  certifications: Joi.string().optional(),
  minimumRate: Joi.number().positive().optional(),
  maximumRate: Joi.number().positive().greater(Joi.ref("minimumRate")).optional(),
  availabilityStatus: Joi.string().valid("FULL_TIME", "PART_TIME", "UNAVAILABLE").optional(),
  weeklyHours: Joi.number().integer().min(0).optional(),
});

const updateProfileSchema = profileSchema.fork(Object.keys(profileSchema.describe().keys), field => field.optional()).min(1);

const portfolioVideoSchema = Joi.object({
  videoUrl: Joi.string().uri().optional(), // Optional if using file upload
  title: Joi.string().optional(),
  description: Joi.string().optional(),
}).or("videoUrl"); // Require videoUrl if no file upload

// Public route
router.get("/public/:userId", getPublicFreelancerProfile);

// Protected routes
router.use(authenticateToken);

router.post("/freelancer", validateBody(profileSchema), createFreelancerProfile);
router.put("/freelancer", validateBody(updateProfileSchema), updateFreelancerProfile);
router.get("/freelancer", getFreelancerProfile);
router.delete("/freelancer", deleteFreelancerProfile);
router.post("/freelancer/portfolio-video", uploadSingle("video"), validateBody(portfolioVideoSchema), addPortfolioVideo);
router.put("/freelancer/portfolio-video/:videoId", uploadSingle("video"), validateBody(portfolioVideoSchema), updatePortfolioVideo);
router.delete("/freelancer/portfolio-video/:videoId", deletePortfolioVideo);

export default router;