// src/routes/jobRoutes.js
import express from "express";
import {
  createJob,
  updateJob,
  deleteJob,
  getJob,
  getClientJobs,
  getAllJobs,
} from "../Controllers/job.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody, validateQuery } from "../Middlewares/validate.middleware.js";
import { uploadSingle } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

const jobSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  category: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
  budgetMin: Joi.number().positive().required(),
  budgetMax: Joi.number().positive().greater(Joi.ref("budgetMin")).required(),
  deadline: Joi.date().greater("now").required(),
  jobDifficulty: Joi.string().valid("EASY", "INTERMEDIATE", "HARD").required(),
  projectLength: Joi.string().valid("SHORT_TERM", "MEDIUM_TERM", "LONG_TERM").required(),
  keyResponsibilities: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
  requiredSkills: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
  tools: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  scope: Joi.string().required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  company: Joi.string().optional(),
  note: Joi.string().optional(),
  videoFileUrl: Joi.string().uri().optional(),
});

const updateJobSchema = jobSchema.fork(Object.keys(jobSchema.describe().keys), field => field.optional()).min(1);

const getJobsSchema = Joi.object({
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Public route
router.get("/all", validateQuery(getJobsSchema), getAllJobs);
router.get("/:jobId", getJob);

// Protected routes
router.use(authenticateToken);

router.post("/", uploadSingle("videoFile"), validateBody(jobSchema), createJob);
router.put("/:jobId", uploadSingle("videoFile"), validateBody(updateJobSchema), updateJob);
router.delete("/:jobId", deleteJob);
router.get("/", validateQuery(getJobsSchema), getClientJobs);

export default router;