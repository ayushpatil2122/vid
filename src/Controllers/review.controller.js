// src/controllers/reviewController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const createReview = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const clientId = req.user.id;
    const { orderId, rating, comment, title, isAnonymous } = req.body;

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return next(new ApiError(400, "Order ID and rating (1-5) are required"));
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { client: true, freelancer: true },
    });
    if (!order || order.clientId !== clientId) {
      return next(new ApiError(404, "Order not found or you don’t own it"));
    }
    if (order.status !== "COMPLETED") {
      return next(new ApiError(400, "Reviews can only be submitted for completed orders"));
    }
    if (await prisma.review.findUnique({ where: { orderId } })) {
      return next(new ApiError(400, "A review already exists for this order"));
    }

    const review = await prisma.review.create({
      data: {
        orderId,
        clientId,
        freelancerId: order.freelancerId,
        rating,
        comment,
        title,
        isAnonymous: isAnonymous || false,
      },
      include: { client: { select: { firstname: true, lastname: true } }, freelancer: true },
    });

    // Update freelancer's average rating
    const reviews = await prisma.review.findMany({ where: { freelancerId: order.freelancerId } });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await prisma.freelancerProfile.update({
      where: { id: order.freelancerId },
      data: { rating: avgRating },
    });

    return res.status(201).json(new ApiResponse(201, review, "Review created successfully"));
  } catch (error) {
    console.error("Error creating review:", error);
    return next(new ApiError(500, "Failed to create review", error.message));
  }
};

const updateReview = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const clientId = req.user.id;
    const { reviewId } = req.params;
    const { rating, comment, title, isAnonymous } = req.body;

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
      include: { order: { include: { client: true } } },
    });
    if (!review || review.order.clientId !== clientId) {
      return next(new ApiError(404, "Review not found or you don’t own it"));
    }
    if (review.moderationStatus !== "APPROVED") {
      return next(new ApiError(400, "Cannot update a review that is not approved"));
    }
    if (new Date() - review.createdAt > 7 * 24 * 60 * 60 * 1000) { // 7-day edit window
      return next(new ApiError(400, "Reviews can only be updated within 7 days of creation"));
    }

    const updatedReview = await prisma.review.update({
      where: { id: parseInt(reviewId) },
      data: {
        rating: rating !== undefined ? Math.min(Math.max(rating, 1), 5) : review.rating,
        comment: comment !== undefined ? comment : review.comment,
        title: title !== undefined ? title : review.title,
        isAnonymous: isAnonymous !== undefined ? isAnonymous : review.isAnonymous,
      },
      include: { client: { select: { firstname: true, lastname: true } }, freelancer: true },
    });

    // Recalculate freelancer rating
    const reviews = await prisma.review.findMany({ where: { freelancerId: review.freelancerId } });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await prisma.freelancerProfile.update({
      where: { id: review.freelancerId },
      data: { rating: avgRating },
    });

    return res.status(200).json(new ApiResponse(200, updatedReview, "Review updated successfully"));
  } catch (error) {
    console.error("Error updating review:", error);
    return next(new ApiError(500, "Failed to update review", error.message));
  }
};

const deleteReview = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { reviewId } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
      include: { order: { include: { client: true } } },
    });
    if (!review) {
      return next(new ApiError(404, "Review not found"));
    }
    if (review.order.clientId !== userId && req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: You can only delete your own reviews or as an admin"));
    }

    await prisma.review.delete({ where: { id: parseInt(reviewId) } });

    // Recalculate freelancer rating
    const reviews = await prisma.review.findMany({ where: { freelancerId: review.freelancerId } });
    const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    await prisma.freelancerProfile.update({
      where: { id: review.freelancerId },
      data: { rating: avgRating },
    });

    return res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
  } catch (error) {
    console.error("Error deleting review:", error);
    return next(new ApiError(500, "Failed to delete review", error.message));
  }
};

const getReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
      include: {
        client: { select: { firstname: true, lastname: true } },
        freelancer: { select: { user: { select: { firstname: true, lastname: true } } } },
        order: { select: { orderNumber: true } },
      },
    });
    if (!review) {
      return next(new ApiError(404, "Review not found"));
    }
    if (review.moderationStatus !== "APPROVED" && (!req.user || (req.user.id !== review.clientId && req.user.role !== "ADMIN"))) {
      return next(new ApiError(403, "Forbidden: Review is not public or you lack permission"));
    }

    return res.status(200).json(new ApiResponse(200, review, "Review retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving review:", error);
    return next(new ApiError(500, "Failed to retrieve review", error.message));
  }
};

const getFreelancerReviews = async (req, res, next) => {
  try {
    const { freelancerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { 
      freelancerId: parseInt(freelancerId),
      moderationStatus: "APPROVED", // Only show approved reviews publicly
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { 
          client: { select: { firstname: true, lastname: true } },
          order: { select: { orderNumber: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        reviews,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "Freelancer reviews retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving freelancer reviews:", error);
    return next(new ApiError(500, "Failed to retrieve freelancer reviews", error.message));
  }
};

// Bonus: Freelancer responds to a review
const respondToReview = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { reviewId } = req.params;
    const { response } = req.body;

    if (!response) {
      return next(new ApiError(400, "Response text is required"));
    }

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
      include: { freelancer: true },
    });
    if (!review || review.freelancer.userId !== userId) {
      return next(new ApiError(404, "Review not found or you don’t own it"));
    }
    if (review.response) {
      return next(new ApiError(400, "A response already exists for this review"));
    }

    const updatedReview = await prisma.review.update({
      where: { id: parseInt(reviewId) },
      data: {
        response,
        respondedAt: new Date(),
      },
      include: { client: { select: { firstname: true, lastname: true } }, freelancer: true },
    });

    return res.status(200).json(new ApiResponse(200, updatedReview, "Response added to review successfully"));
  } catch (error) {
    console.error("Error responding to review:", error);
    return next(new ApiError(500, "Failed to respond to review", error.message));
  }
};

export { createReview, updateReview, deleteReview, getReview, getFreelancerReviews, respondToReview };