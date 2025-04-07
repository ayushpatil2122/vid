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
import { checkOwnership } from "../Middlewares/ownership.middlware.js";

const router = express.Router();

// Public routes
router.get("/all", getAllGigs);

// Protected routes
router.use(authenticateToken);
router.get("/freelancer", getFreelancerGigs); // Specific route BEFORE wildcard
router.post("/", createGig);
router.put("/gigs/:gigId", checkOwnership("Gig", "gigId", "freelancerId"), updateGig);
router.delete("/:gigId", deleteGig);

// Public route - AFTER specific routes
router.get("/:gigId", getGig); // Wildcard route LAST

export default router;