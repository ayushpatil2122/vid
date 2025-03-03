// src/middlewares/error.middleware.js
import { ApiError } from "../Utils/ApiError.js";

/**
 * Global error handler
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging (in production, use a logging service like Winston)
  console.error(`Error occurred: ${req.method} ${req.path}`, {
    message: err.message,
    stack: err.stack,
    user: req.user ? req.user.id : "Unauthenticated",
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors || [],
      success: false,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      statusCode: 400,
      message: `File upload error: ${err.message}`,
      errors: [],
      success: false,
      timestamp: new Date().toISOString(),
    });
  }

  // Generic unhandled errors
  return res.status(500).json({
    statusCode: 500,
    message: "Internal Server Error",
    errors: [{ message: "An unexpected error occurred" }],
    success: false,
    timestamp: new Date().toISOString(),
  });
};

export { errorHandler };