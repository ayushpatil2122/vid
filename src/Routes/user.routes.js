// src/routes/userRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  updateUser,
  getUserProfile,
  deleteUser,
} from "../Controllers/user.controller.js";
import { authenticateToken } from "../Middlewares/protect.middleware.js";
import { validateBody } from "../Middlewares/validate.middleware.js";
import { uploadSingle } from "../Middlewares/upload.middleware.js";
import Joi from "joi";

const router = express.Router();

const registerUserSchema = Joi.object({
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  country: Joi.string().required(),
  role: Joi.string().valid('FREELANCER', 'CLIENT', 'ADMIN').required(), // Add role with valid enum values
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
  profilePicture: Joi.string().uri().optional(),
  bio: Joi.string().optional(),
}).min(1); // At least one field required

// Public routes
router.post("/register", validateBody(registerUserSchema), registerUser);
router.post("/login", validateBody(loginUserSchema), loginUser);
//router.get("/:userId", getPublicUserProfile);

// Protected routes
router.use(authenticateToken);

// Fetch current authenticated user's profile (used for state restoration after refresh)
router.get("/me", getUserProfile);
router.put("/update", uploadSingle("profilePicture"), validateBody(updateUserSchema), updateUser);
router.delete("/delete", deleteUser);

export default router;