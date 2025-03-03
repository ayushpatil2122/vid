// src/middlewares/ownership.middleware.js
import { ApiError } from "../Utils/ApiError.js";
import prisma from "../prismaClient.js";

/**
 * Checks ownership of a resource
 * @param {string} resourceType - Type of resource (e.g., "Gig", "Order")
 * @param {string} idParam - Name of the ID parameter in req.params
 * @param {string} ownerField - Field in the resource that identifies the owner (e.g., "freelancerId", "clientId")
 * @returns {Function} Middleware function
 */
const checkOwnership = (resourceType, idParam, ownerField) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const resourceId = parseInt(req.params[idParam]);

    let resource;
    try {
      switch (resourceType.toLowerCase()) {
        case "gig":
          resource = await prisma.gig.findUnique({
            where: { id: resourceId },
            include: { freelancer: true },
          });
          if (resource && resource.freelancer.userId !== userId) {
            return next(new ApiError(403, "Forbidden: You can only modify your own gigs"));
          }
          break;
        case "order":
          resource = await prisma.order.findUnique({
            where: { id: resourceId },
            include: { client: true, freelancer: true },
          });
          if (resource && resource[ownerField] !== userId && (ownerField === "clientId" || resource.freelancer.userId !== userId)) {
            return next(new ApiError(403, "Forbidden: You can only modify your own orders"));
          }
          break;
        default:
          return next(new ApiError(400, `Unsupported resource type: ${resourceType}`));
      }

      if (!resource) {
        return next(new ApiError(404, `${resourceType} not found`));
      }

      req.resource = resource; // Attach resource to request for downstream use
      next();
    } catch (error) {
      console.error(`Error checking ownership for ${resourceType}:`, error);
      return next(new ApiError(500, `Failed to verify ownership for ${resourceType}`, error.message));
    }
  };
};

export { checkOwnership };