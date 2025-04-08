import express from "express";
import {
  registerUser,
  loginUser,
  updateUser,
  getUserProfile,
  deleteUser,
  deleteItem,
  getAllBadges,
} from "../Controllers/user.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody } from "../Middlewares/validate.middleware.js";
import { uploadSingle } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

// Validation schemas
const registerUserSchema = Joi.object({
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  country: Joi.string().required(),
  role: Joi.string().valid("FREELANCER", "CLIENT", "ADMIN").required(),
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateUserSchema = Joi.object({
  firstname: Joi.string().optional(),
  lastname: Joi.string().optional(),
  email: Joi.string().email().optional(),
  country: Joi.string().optional(),
  password: Joi.string().min(6).optional(),
  username: Joi.string().optional(),
  bio: Joi.string().allow("").optional(),
  company: Joi.string().allow("").optional(),
  companyEmail: Joi.string().email().allow("").optional(),
  profilePicture: Joi.any().optional(),
  isVerified: Joi.boolean().optional(),
  portfolio: Joi.array().items(Joi.object({ id: Joi.string(), title: Joi.string(), category: Joi.string(), url: Joi.string() })).optional(),
  services: Joi.array().items(Joi.object({ id: Joi.string(), title: Joi.string(), description: Joi.string() })).optional(),
  gigs: Joi.array().items(Joi.object({ id: Joi.string(), title: Joi.string(), price: Joi.string(), description: Joi.string(), deliveryTime: Joi.string() })).optional(),
  userBadges: Joi.array().items(Joi.object({ id: Joi.string(), badgeId: Joi.string(), isVisible: Joi.boolean() })).optional(),
  city: Joi.string().allow("").optional(),
  pinCode: Joi.string().allow("").optional(),
  state: Joi.string().allow("").optional(),
  jobTitle: Joi.string().allow("").optional(),
  overview: Joi.string().allow("").optional(),
  skills: Joi.array().items(Joi.string()).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  socialLinks: Joi.object().optional(),
  tools: Joi.array().items(Joi.string()).optional(),
  equipmentCameras: Joi.string().allow("").optional(),
  equipmentLenses: Joi.string().allow("").optional(),
  equipmentLighting: Joi.string().allow("").optional(),
  equipmentOther: Joi.string().allow("").optional(),
  certifications: Joi.array().items(Joi.string()).optional(),
  minimumRate: Joi.number().optional(),
  maximumRate: Joi.number().optional(),
  hourlyRate: Joi.number().optional(),
  weeklyHours: Joi.number().integer().optional(),
  availabilityStatus: Joi.string().valid("FULL_TIME", "PART_TIME", "UNAVAILABLE").optional(),
  experienceLevel: Joi.string().valid("ENTRY", "INTERMEDIATE", "EXPERT").optional(),
}).min(1);

// Public routes
router.post("/register", validateBody(registerUserSchema), registerUser);
router.post("/login", validateBody(loginUserSchema), loginUser);
router.get("/profile/:userId", getUserProfile); // Public profile view

// Protected routes
router.use(authenticateToken);

router.get("/me", getUserProfile);
router.patch("/me", uploadSingle("profilePicture"), validateBody(updateUserSchema), updateUser);
router.delete("/delete", deleteUser);
router.delete("/me/:type/:id", deleteItem); // Delete specific item (portfolio, services, gigs)
router.get("/badges", getAllBadges); // Fetch all badges

export default router;