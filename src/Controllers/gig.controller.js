// src/controllers/gigController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import multer from "multer";
import path from "path";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|mp4/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new ApiError(400, "File must be JPEG, PNG, or MP4"));
  },
}).fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "sampleMedia", maxCount: 3 }, // Adjust maxCount as needed
]);

const createGig = async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return next(new ApiError(400, err.message));
    }

    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const freelancerId = req.user.id;

      const {
        title, description, category, pricing, deliveryTime, revisionCount,
        tags, requirements, faqs, packageDetails,
      } = req.body;

      // Validate required fields
      if (!title || !pricing || !deliveryTime) {
        return next(new ApiError(400, "Missing required fields: title, pricing, and deliveryTime are mandatory."));
      }

      // Parse JSON fields
      const parsedPricing = JSON.parse(pricing);
      const parsedTags = tags ? JSON.parse(tags) : [];
      const parsedFaqs = faqs ? JSON.parse(faqs) : [];
      const parsedPackageDetails = packageDetails ? JSON.parse(packageDetails) : [];

      // Validate pricing
      if (!Array.isArray(parsedPricing) || parsedPricing.length === 0) {
        return next(new ApiError(400, "Pricing must be a non-empty array of objects."));
      }

      // Validate deliveryTime
      const parsedDeliveryTime = parseInt(deliveryTime);
      if (isNaN(parsedDeliveryTime) || parsedDeliveryTime <= 0) {
        return next(new ApiError(400, "Delivery time must be a positive integer."));
      }

      const freelancerProfile = await prisma.freelancerProfile.findUnique({
        where: { userId: freelancerId },
      });
      if (!freelancerProfile) {
        return next(new ApiError(404, "Freelancer profile not found. Create a profile first."));
      }

      // Handle thumbnail and sample media
      const sampleMediaData = [];
      
      // Add thumbnail as a special sample media entry
      if (req.files?.thumbnail?.[0]) {
        sampleMediaData.push({
          mediaUrl: `/uploads/${req.files.thumbnail[0].filename}`,
          mediaType: req.files.thumbnail[0].mimetype.split("/")[1] === "mp4" ? "video" : "thumbnail", // Distinguish thumbnail
        });
      }

      // Add other sample media
      if (req.files?.sampleMedia) {
        req.files.sampleMedia.forEach(file => {
          sampleMediaData.push({
            mediaUrl: `/uploads/${file.filename}`,
            mediaType: file.mimetype.split("/")[1] === "mp4" ? "video" : "image",
          });
        });
      }

      const gig = await prisma.gig.create({
        data: {
          freelancerId: freelancerProfile.id,
          title,
          description,
          category,
          pricing: parsedPricing,
          deliveryTime: parsedDeliveryTime,
          revisionCount: revisionCount ? parseInt(revisionCount) : null,
          tags: parsedTags,
          requirements,
          faqs: parsedFaqs,
          packageDetails: parsedPackageDetails,
          sampleMedia: { create: sampleMediaData }, // Create related sample media
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
  });
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

    if (!gigId || isNaN(parseInt(gigId))) {
      return next(new ApiError(400, "Valid gigId is required"));
    }

    const gig = await prisma.gig.findUnique({
      where: { id: parseInt(gigId) },
      include: {
        sampleMedia: true,
        freelancer: {
          include: {
            user: { select: { firstname: true, lastname: true, email: true } },
          },
        },
      },
    });
    if (!gig) {
      return next(new ApiError(404, "Gig not found."));
    }

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
    console.log("Request user:", req.user); // Debug
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const freelancerId = req.user.id;

    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: freelancerId },
    });
    console.log("Freelancer profile:", freelancerProfile); // Debug
    if (!freelancerProfile) {
      return next(new ApiError(404, "Freelancer profile not found"));
    }

    const gigs = await prisma.gig.findMany({
      where: { freelancerId: freelancerProfile.id },
      include: { sampleMedia: true },
    });
    console.log("Fetched gigs:", gigs); // Debug

    return res.status(200).json(
      new ApiResponse(200, gigs, "Freelancer gigs retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching freelancer gigs:", error);
    return next(new ApiError(500, "Failed to fetch freelancer gigs", error.message));
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