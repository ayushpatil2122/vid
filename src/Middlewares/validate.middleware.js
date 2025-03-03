// src/middlewares/validate.middleware.js
import { ApiError } from "../Utils/ApiError.js";
import Joi from "joi";

/**
 * Validates request body against a Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Middleware function
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Show all validation errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return next(new ApiError(400, "Validation failed", errorDetails));
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Validates request query parameters against a Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Middleware function
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return next(new ApiError(400, "Query validation failed", errorDetails));
    }

    req.query = value;
    next();
  };
};

export { validateBody, validateQuery };