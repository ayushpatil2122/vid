import express from "express";
import {
  getFreelancerSkills,
  getFreelancerSoftware,
} from "../Controllers/freelancer.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/skills", getFreelancerSkills);
router.get("/software", getFreelancerSoftware);

export default router;