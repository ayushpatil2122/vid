// src/routes/gigRoutes.js
import express from "express";
import {
  createGig,
  updateGig,
  deleteGig,
  getGig,
  getFreelancerGigs,
  getAllGigs,
} from "../Controllers/gig.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import {checkOwnership} from "../Middlewares/ownership.middlware.js"

const router = express.Router();

// Public routes (no authentication required)
router.get("/all", getAllGigs); // Get all active gigs with filtering and pagination
router.get("/:gigId", getGig);  // Get a single gig by ID

// Protected routes (require authentication)
router.use(authenticateToken);

router.post("/", createGig);            // Create a new gig
router.put("/gigs/:gigId", authenticateToken, checkOwnership("Gig", "gigId", "freelancerId"), updateGig);
router.delete("/:gigId", deleteGig);    // Delete a gig
router.get("/freelancer/all", getFreelancerGigs); // Get all gigs by the authenticated freelancer

export default router;