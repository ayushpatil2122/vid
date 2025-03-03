// src/controllers/searchController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const searchGigs = async (req, res, next) => {
  try {
    const {
      category, search, minBudget, maxBudget, deliveryTime, rating, sortBy = "createdAt", sortOrder = "desc", page = 1, limit = 20,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      status: "ACTIVE",
      isVerified: true,
    };

    if (category) where.category = { has: category };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }
    if (minBudget) where.pricing = { path: "$.basic", gte: parseFloat(minBudget) }; // Adjust for JSON pricing
    if (maxBudget) where.pricing = { path: "$.premium", lte: parseFloat(maxBudget) }; // Adjust for JSON pricing
    if (deliveryTime) where.deliveryTime = { lte: parseInt(deliveryTime) };
    if (rating) where.freelancer = { rating: { gte: parseFloat(rating) } };

    const [gigs, total] = await Promise.all([
      prisma.gig.findMany({
        where,
        include: {
          freelancer: { select: { user: { select: { firstname: true, lastname: true } }, rating: true } },
          sampleMedia: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
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
      }, "Gigs search results retrieved successfully")
    );
  } catch (error) {
    console.error("Error searching gigs:", error);
    return next(new ApiError(500, "Failed to search gigs", error.message));
  }
};

const searchFreelancers = async (req, res, next) => {
  try {
    const {
      skills, minRate, maxRate, availabilityStatus, rating, location, search, sortBy = "rating", sortOrder = "desc", page = 1, limit = 20,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      user: { isActive: true },
    };

    if (skills) {
      const skillArray = Array.isArray(skills) ? skills : [skills];
      where.skills = { hasEvery: skillArray };
    }
    if (minRate) where.minimumRate = { gte: parseFloat(minRate) };
    if (maxRate) where.maximumRate = { lte: parseFloat(maxRate) };
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (rating) where.rating = { gte: parseFloat(rating) };
    if (location) where.user = { country: { equals: location, mode: "insensitive" } };
    if (search) {
      where.OR = [
        { jobTitle: { contains: search, mode: "insensitive" } },
        { overview: { contains: search, mode: "insensitive" } },
        { user: { firstname: { contains: search, mode: "insensitive" } } },
        { user: { lastname: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [freelancers, total] = await Promise.all([
      prisma.freelancerProfile.findMany({
        where,
        include: {
          user: { select: { firstname: true, lastname: true, country: true, profilePicture: true } },
          portfolioVideos: { take: 3 }, // Limit portfolio videos for performance
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.freelancerProfile.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        freelancers,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "Freelancers search results retrieved successfully")
    );
  } catch (error) {
    console.error("Error searching freelancers:", error);
    return next(new ApiError(500, "Failed to search freelancers", error.message));
  }
};

export { searchGigs, searchFreelancers };