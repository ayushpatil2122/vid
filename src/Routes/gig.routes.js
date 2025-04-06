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
router.get("/:gigId", getGig);

// Protected routes
router.use(authenticateToken);
router.post("/", createGig); // No additional middleware needed; multer is in controller
router.put("/gigs/:gigId", checkOwnership("Gig", "gigId", "freelancerId"), updateGig);
router.delete("/:gigId", deleteGig);
router.get("/freelancer", getFreelancerGigs);

export default router;