// src/middlewares/restrict.middleware.js
import { ApiError } from "../Utils/ApiError.js";

/**
 * Restricts access to specific roles
 * @param {...string} roles - Roles allowed to access the route (e.g., "FREELANCER", "CLIENT", "ADMIN")
 * @returns {Function} Middleware function
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated and has a role
    if (!req.user || !req.user.role) {
      return next(new ApiError(401, "Unauthorized: User not authenticated or role missing"));
    }

    // Check if user's role is allowed
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Forbidden: Role '${req.user.role}' does not have permission. Required roles: ${roles.join(", ")}`));
    }

    // Log access for auditing (optional for large-scale systems)
    console.log(`User ${req.user.id} with role ${req.user.role} accessed restricted route: ${req.method} ${req.path}`);

    next();
  };
};

/**
 * Advanced: Check if user has any of multiple role sets (e.g., ["FREELANCER", "ADMIN"] OR ["CLIENT"])
 * @param {Array<Array<string>>} roleSets - Array of role sets (OR conditions)
 * @returns {Function} Middleware function
 */
const restrictToAny = (roleSets) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new ApiError(401, "Unauthorized: User not authenticated or role missing"));
    }

    const hasPermission = roleSets.some(set => set.includes(req.user.role));
    if (!hasPermission) {
      return next(new ApiError(403, `Forbidden: Role '${req.user.role}' does not match any allowed role sets: ${JSON.stringify(roleSets)}`));
    }

    console.log(`User ${req.user.id} with role ${req.user.role} accessed advanced restricted route: ${req.method} ${req.path}`);
    next();
  };
};

export { restrictTo, restrictToAny };