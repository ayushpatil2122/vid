// src/controllers/gigController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const createGig = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const freelancerId = req.user.id;

    const {
      title, description, category, pricing, deliveryTime, revisionCount,
      tags, requirements, faqs, packageDetails, sampleMedia,
    } = req.body;

    // Validate required fields
    if (!title || !pricing || !deliveryTime) {
      return next(new ApiError(400, "Missing required fields: title, pricing, and deliveryTime are mandatory."));
    }

    // Validate pricing (must be a valid JSON object)
    if (typeof pricing !== "object" || Object.keys(pricing).length === 0) {
      return next(new ApiError(400, "Pricing must be a non-empty JSON object (e.g., {'basic': 50})."));
    }

    // Validate deliveryTime
    const parsedDeliveryTime = parseInt(deliveryTime);
    if (isNaN(parsedDeliveryTime) || parsedDeliveryTime <= 0) {
      return next(new ApiError(400, "Delivery time must be a positive integer."));
    }

    // Validate sampleMedia if provided
    if (sampleMedia && (!Array.isArray(sampleMedia) || sampleMedia.some(m => !m.mediaUrl || !m.mediaType))) {
      return next(new ApiError(400, "Sample media must be an array with mediaUrl and mediaType for each entry."));
    }

    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: freelancerId },
    });
    if (!freelancerProfile) {
      return next(new ApiError(404, "Freelancer profile not found. Create a profile first."));
    }

    const gig = await prisma.gig.create({
      data: {
        freelancerId: freelancerProfile.id,
        title,
        description,
        category,
        pricing,
        deliveryTime: parsedDeliveryTime,
        revisionCount: revisionCount ? parseInt(revisionCount) : null,
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        requirements,
        faqs,
        packageDetails,
        sampleMedia: sampleMedia ? {
          create: sampleMedia.map(media => ({
            mediaUrl: media.mediaUrl,
            mediaType: media.mediaType,
            title: media.title,
            description: media.description,
          })),
        } : undefined,
      },
      include: { sampleMedia: true },
    });

    return res.status(201).json(
      new ApiResponse(201, gig, "Gig created successfully")
    );
  } catch (error) {
    console.error("Error creating gig:", error);
    return next(new ApiError(500, "Failed to create gig", error.message));
  }
};

const updateGig = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const freelancerId = req.user.id;
    const { gigId } = req.params;

    const {
      title, description, category, pricing, deliveryTime, revisionCount,
      tags, requirements, faqs, packageDetails, sampleMedia,
    } = req.body;

    const gig = await prisma.gig.findUnique({
      where: { id: parseInt(gigId) },
      include: { freelancer: true },
    });
    if (!gig) {
      return next(new ApiError(404, "Gig not found."));
    }
    if (gig.freelancer.userId !== freelancerId) {
      return next(new ApiError(403, "Forbidden: You can only update your own gigs."));
    }

    // Validate updates
    if (pricing && (typeof pricing !== "object" || Object.keys(pricing).length === 0)) {
      return next(new ApiError(400, "Pricing must be a non-empty JSON object."));
    }
    if (deliveryTime && (isNaN(parseInt(deliveryTime)) || parseInt(deliveryTime) <= 0)) {
      return next(new ApiError(400, "Delivery time must be a positive integer."));
    }

    const updatedGig = await prisma.gig.update({
      where: { id: parseInt(gigId) },
      data: {
        title: title !== undefined ? title : gig.title,
        description: description !== undefined ? description : gig.description,
        category: category !== undefined ? category : gig.category,
        pricing: pricing !== undefined ? pricing : gig.pricing,
        deliveryTime: deliveryTime ? parseInt(deliveryTime) : gig.deliveryTime,
        revisionCount: revisionCount !== undefined ? parseInt(revisionCount) : gig.revisionCount,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags : tags ? [tags] : []) : gig.tags,
        requirements: requirements !== undefined ? requirements : gig.requirements,
        faqs: faqs !== undefined ? faqs : gig.faqs,
        packageDetails: packageDetails !== undefined ? packageDetails : gig.packageDetails,
        sampleMedia: sampleMedia ? {
          deleteMany: {}, // Clear existing media
          create: sampleMedia.map(media => ({
            mediaUrl: media.mediaUrl,
            mediaType: media.mediaType,
            title: media.title,
            description: media.description,
          })),
        } : undefined,
      },
      include: { sampleMedia: true },
    });

    return res.status(200).json(
      new ApiResponse(200, updatedGig, "Gig updated successfully")
    );
  } catch (error) {
    console.error("Error updating gig:", error);
    return next(new ApiError(500, "Failed to update gig", error.message));
  }
};

const deleteGig = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const freelancerId = req.user.id;
    const { gigId } = req.params;

    const gig = await prisma.gig.findUnique({
      where: { id: parseInt(gigId) },
      include: { freelancer: true },
    });
    if (!gig) {
      return next(new ApiError(404, "Gig not found."));
    }
    if (gig.freelancer.userId !== freelancerId) {
      return next(new ApiError(403, "Forbidden: You can only delete your own gigs."));
    }

    await prisma.gig.delete({
      where: { id: parseInt(gigId) },
    });

    return res.status(200).json(
      new ApiResponse(200, null, "Gig deleted successfully")
    );
  } catch (error) {
    console.error("Error deleting gig:", error);
    return next(new ApiError(500, "Failed to delete gig", error.message));
  }
};

const getGig = async (req, res, next) => {
  try {
    const { gigId } = req.params;

    const gig = await prisma.gig.findUnique({
      where: { id: parseInt(gigId) },
      include: {
        sampleMedia: true,
        freelancer: {
          include: {
            user: { select: { firstname, lastname, email } },
          },
        },
      },
    });
    if (!gig) {
      return next(new ApiError(404, "Gig not found."));
    }

    // Increment views
    await prisma.gig.update({
      where: { id: parseInt(gigId) },
      data: { views: gig.views + 1 },
    });

    return res.status(200).json(
      new ApiResponse(200, gig, "Gig retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving gig:", error);
    return next(new ApiError(500, "Failed to retrieve gig", error.message));
  }
};

const getFreelancerGigs = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const freelancerId = req.user.id;

    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: freelancerId },
    });
    if (!freelancerProfile) {
      return next(new ApiError(404, "Freelancer profile not found."));
    }

    const gigs = await prisma.gig.findMany({
      where: { freelancerId: freelancerProfile.id },
      include: {
        sampleMedia: true,
        orders: {
          include: {
            transactions: {
              where: { type: "PAYMENT", status: "COMPLETED" },
              select: { amount: true },
            },
            review: {
              select: { rating: true },
            },
          },
        },
      },
    });

    const enrichedGigs = gigs.map(gig => {
      const earnings = gig.orders.reduce((sum, order) => {
        return sum + (order.transactions.reduce((tSum, t) => tSum + t.amount, 0));
      }, 0);
      const ratings = gig.orders.map(order => order.review?.rating || 0).filter(r => r > 0);
      const averageRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : "N/A";

      return {
        ...gig,
        earnings,
        orderCount: gig.orders.length,
        averageRating,
      };
    });

    return res.status(200).json(
      new ApiResponse(200, enrichedGigs, "Freelancer gigs retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving freelancer gigs:", error);
    return next(new ApiError(500, "Failed to retrieve freelancer gigs", error.message));
  }
};

// src/controllers/gigController.js
const getAllGigs = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      status: "ACTIVE", // Only show active gigs
    };
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    const [gigs, total] = await Promise.all([
      prisma.gig.findMany({
        where,
        include: { 
          sampleMedia: true, 
          freelancer: { 
            select: { 
              user: { 
                select: { 
                  firstname: true, // Correct syntax: field name as key
                  lastname: true  // Correct syntax: field name as key
                } 
              } 
            } 
          } 
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.gig.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        gigs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "All gigs retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving all gigs:", error);
    return next(new ApiError(500, "Failed to retrieve all gigs", error.message));
  }
};

export {
  createGig,
  updateGig,
  deleteGig,
  getGig,
  getFreelancerGigs,
  getAllGigs,
};