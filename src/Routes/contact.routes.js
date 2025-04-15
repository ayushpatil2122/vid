import express from "express";
import {
  createContactSubmission,
  getContactSubmissions,
  getContactSubmissionById,
  updateContactSubmission,
  deleteContactSubmission,
  assignAdminToSubmission,
  addResolutionNote,
  getSubmissionFiles,
  deleteSubmissionFile,
} from "../Controllers/contact.controller.js";
import {uploadMultiple} from "../Middlewares/upload.middleware.js";
import { protect, restrictTo } from "../Middlewares/auth.middleware.js"; // Assumed auth middleware

const router = express.Router();

// Public route (for users submitting contact forms)
router.post("/", uploadMultiple("files", 5), createContactSubmission);

// Admin-only routes (protected and restricted to admins)
router.use(protect, restrictTo("admin")); // All routes below require admin role

router.get("/", getContactSubmissions); // List all submissions with filters
router.get("/:id", getContactSubmissionById); // Get a single submission with files
router.patch("/:id", updateContactSubmission); // Update submission (status, isResolved, etc.)
router.delete("/:id", deleteContactSubmission); // Delete a submission and its files
router.patch("/:id/assign", assignAdminToSubmission); // Assign an admin to a submission
router.post("/:id/notes", addResolutionNote); // Add a resolution note
router.get("/:id/files", getSubmissionFiles); // Get files for a submission
router.delete("/:id/files/:fileId", deleteSubmissionFile); // Delete a specific file

export default router;