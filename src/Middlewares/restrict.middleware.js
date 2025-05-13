
import { ApiError } from "../Utils/ApiError.js";

/**
 * Restricts access to specific roles
 * @param {...string} roles - Roles allowed to access the route (e.g., "FREELANCER", "CLIENT", "ADMIN")
 * @returns {Function} Middleware function
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Validate user and role
    if (!req.user || typeof req.user !== 'object') {
      console.error('[restrictTo] No user object in request:', req.user);
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }

    const userRole = req.user.role?.trim();
    if (!userRole || typeof userRole !== 'string') {
      console.error('[restrictTo] Invalid or missing user role:', req.user);
      return next(new ApiError(401, "Unauthorized: User role missing or invalid"));
    }

    // Flatten and validate roles
    const flatRoles = roles.flat(Infinity).filter(role => typeof role === 'string' && role.trim() !== '');
    if (flatRoles.length === 0) {
      console.error('[restrictTo] No valid roles provided:', roles);
      return next(new ApiError(500, "Server error: No valid roles specified"));
    }

    // Normalize roles for case-insensitive comparison
    const normalizedRoles = flatRoles.map(role => role.trim().toUpperCase());

    console.log('[restrictTo] Checking role:', {
      userRole,
      normalizedUserRole: userRole.toUpperCase(),
      requiredRoles: normalizedRoles,
      rawRoles: roles,
      path: `${req.method} ${req.path}`,
      userId: req.user.id
    });

    // Check if user's role is allowed
    if (!normalizedRoles.includes(userRole.toUpperCase())) {
      console.error('[restrictTo] Role check failed:', {
        userRole,
        normalizedUserRole: userRole.toUpperCase(),
        requiredRoles: normalizedRoles
      });
      return next(
        new ApiError(
          403,
          `Forbidden: Role '${userRole}' does not have permission. Required roles: ${normalizedRoles.join(", ")}`
        )
      );
    }

    console.log('[restrictTo] Role check passed for user:', req.user.id);
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
    // Validate user and role
    if (!req.user || typeof req.user !== 'object') {
      console.error('[restrictToAny] No user object in request:', req.user);
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }

    const userRole = req.user.role?.trim();
    if (!userRole || typeof userRole !== 'string') {
      console.error('[restrictToAny] Invalid or missing user role:', req.user);
      return next(new ApiError(401, "Unauthorized: User role missing or invalid"));
    }

    // Validate roleSets
    if (!Array.isArray(roleSets) || roleSets.length === 0) {
      console.error('[restrictToAny] Invalid roleSets:', roleSets);
      return next(new ApiError(500, "Server error: Invalid role sets configuration"));
    }

    // Flatten and normalize role sets
    const normalizedRoleSets = roleSets
      .map(set => {
        if (!Array.isArray(set)) {
          console.warn('[restrictToAny] Invalid role set:', set);
          return [];
        }
        return set
          .flat(Infinity)
          .filter(role => typeof role === 'string' && role.trim() !== '')
          .map(role => role.trim().toUpperCase());
      })
      .filter(set => set.length > 0);

    if (normalizedRoleSets.length === 0) {
      console.error('[restrictToAny] No valid role sets provided:', roleSets);
      return next(new ApiError(500, "Server error: No valid role sets specified"));
    }

    console.log('[restrictToAny] Checking role sets:', {
      userRole,
      normalizedUserRole: userRole.toUpperCase(),
      requiredRoleSets: normalizedRoleSets,
      rawRoleSets: roleSets,
      path: `${req.method} ${req.path}`,
      userId: req.user.id
    });

    // Check if user role matches any role set
    const hasPermission = normalizedRoleSets.some(set => set.includes(userRole.toUpperCase()));
    if (!hasPermission) {
      console.error('[restrictToAny] Role set check failed:', {
        userRole,
        normalizedUserRole: userRole.toUpperCase(),
        requiredRoleSets: normalizedRoleSets
      });
      return next(
        new ApiError(
          403,
          `Forbidden: Role '${userRole}' does not match any allowed role sets: ${JSON.stringify(normalizedRoleSets)}`
        )
      );
    }

    console.log('[restrictToAny] Role set check passed for user:', req.user.id);
    next();
  };
};

export { restrictTo, restrictToAny };
