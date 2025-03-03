// src/controllers/disputeController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const createDispute = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const raisedById = req.user.id;
    const { orderId, reason, description } = req.body;

    if (!orderId || !reason) {
      return next(new ApiError(400, "Order ID and reason are required"));
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { client: true, freelancer: true },
    });
    if (!order || (order.clientId !== raisedById && order.freelancer.userId !== raisedById)) {
      return next(new ApiError(404, "Order not found or you don’t have access"));
    }
    if (order.status === "PENDING" || order.status === "CANCELLED") {
      return next(new ApiError(400, "Disputes can only be raised for active or completed orders"));
    }
    if (await prisma.dispute.findUnique({ where: { orderId } })) {
      return next(new ApiError(400, "A dispute already exists for this order"));
    }

    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        raisedById,
        reason,
        description,
      },
      include: { order: { select: { orderNumber: true } }, raisedBy: { select: { firstname: true, lastname: true } } },
    });

    // Notify involved parties
    const otherPartyId = order.clientId === raisedById ? order.freelancer.userId : order.clientId;
    await prisma.notification.createMany({
      data: [
        { userId: otherPartyId, type: "DISPUTE", content: `A dispute has been raised for order ${order.orderNumber}` },
        { userId: 1, type: "DISPUTE", content: `New dispute #${dispute.id} raised for order ${order.orderNumber}` }, // Admin notification (adjust admin ID)
      ],
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "DISPUTED", statusHistory: { create: { status: "DISPUTED", changedBy: raisedById } } },
    });

    return res.status(201).json(new ApiResponse(201, dispute, "Dispute created successfully"));
  } catch (error) {
    console.error("Error creating dispute:", error);
    return next(new ApiError(500, "Failed to create dispute", error.message));
  }
};

const updateDisputeStatus = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { disputeId } = req.params;
    const { status, resolution } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(disputeId) },
      include: { order: { include: { client: true, freelancer: true } } },
    });
    if (!dispute) {
      return next(new ApiError(404, "Dispute not found"));
    }
    if (req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Only admins can update dispute status"));
    }

    const validStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
    if (!status || !validStatuses.includes(status)) {
      return next(new ApiError(400, `Invalid status. Allowed: ${validStatuses.join(", ")}`));
    }
    if ((status === "RESOLVED" || status === "CLOSED") && !resolution) {
      return next(new ApiError(400, "Resolution is required for RESOLVED or CLOSED status"));
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: parseInt(disputeId) },
      data: {
        status,
        resolution: resolution || dispute.resolution,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : dispute.resolvedAt,
        resolvedBy: status === "RESOLVED" || status === "CLOSED" ? userId : dispute.resolvedBy,
      },
      include: { order: { select: { orderNumber: true } }, raisedBy: { select: { firstname: true, lastname: true } } },
    });

    // Notify parties
    await prisma.notification.createMany({
      data: [
        { userId: dispute.raisedById, type: "DISPUTE", content: `Dispute #${disputeId} updated to ${status}` },
        { userId: dispute.order.clientId === dispute.raisedById ? dispute.order.freelancer.userId : dispute.order.clientId, type: "DISPUTE", content: `Dispute #${disputeId} updated to ${status}` },
      ],
    });

    // Update order status if resolved
    if (status === "RESOLVED" || status === "CLOSED") {
      await prisma.order.update({
        where: { id: dispute.orderId },
        data: { status: "COMPLETED", statusHistory: { create: { status: "COMPLETED", changedBy: userId } } }, // Adjust logic as needed
      });
    }

    return res.status(200).json(new ApiResponse(200, updatedDispute, "Dispute status updated successfully"));
  } catch (error) {
    console.error("Error updating dispute status:", error);
    return next(new ApiError(500, "Failed to update dispute status", error.message));
  }
};

const getDispute = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { disputeId } = req.params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(disputeId) },
      include: {
        order: { include: { client: { select: { firstname: true, lastname: true } }, freelancer: { select: { user: { select: { firstname: true, lastname: true } } } } } },
        raisedBy: { select: { firstname: true, lastname: true } },
        resolver: { select: { firstname: true, lastname: true } },
        evidence: { include: { uploader: { select: { firstname: true, lastname: true } } } },
        comments: { include: { user: { select: { firstname: true, lastname: true } } } },
      },
    });
    if (!dispute) {
      return next(new ApiError(404, "Dispute not found"));
    }
    if (dispute.raisedById !== userId && dispute.order.clientId !== userId && dispute.order.freelancer.userId !== userId && req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: You can only view your own disputes or as an admin"));
    }

    return res.status(200).json(new ApiResponse(200, dispute, "Dispute retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving dispute:", error);
    return next(new ApiError(500, "Failed to retrieve dispute", error.message));
  }
};

const getUserDisputes = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      OR: [
        { raisedById: userId },
        { order: { clientId: userId } },
        { order: { freelancer: { userId } } },
      ],
    };
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: { order: { select: { orderNumber: true } }, raisedBy: { select: { firstname: true, lastname: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.dispute.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        disputes,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "User disputes retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving user disputes:", error);
    return next(new ApiError(500, "Failed to retrieve user disputes", error.message));
  }
};

// Bonus: Add evidence to a dispute
const addDisputeEvidence = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { disputeId } = req.params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(disputeId) },
      include: { order: { include: { client: true, freelancer: true } } },
    });
    if (!dispute || (dispute.raisedById !== userId && dispute.order.clientId !== userId && dispute.order.freelancer.userId !== userId)) {
      return next(new ApiError(404, "Dispute not found or you don’t have access"));
    }
    if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
      return next(new ApiError(400, "Cannot add evidence to a resolved or closed dispute"));
    }

    const evidenceData = req.fileUrls.map(url => ({
      fileUrl: url,
      fileType: "image/png", // Adjust based on actual file type from upload
      fileName: url.split("/").pop(),
      uploadedBy: userId,
    }));

    const evidence = await prisma.disputeEvidence.createMany({
      data: evidenceData,
    });

    return res.status(201).json(new ApiResponse(201, evidence, "Evidence added to dispute successfully"));
  } catch (error) {
    console.error("Error adding dispute evidence:", error);
    return next(new ApiError(500, "Failed to add dispute evidence", error.message));
  }
};

// Bonus: Add a comment to a dispute
const addDisputeComment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { disputeId } = req.params;
    const { content } = req.body;

    if (!content) {
      return next(new ApiError(400, "Comment content is required"));
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(disputeId) },
      include: { order: { include: { client: true, freelancer: true } } },
    });
    if (!dispute || (dispute.raisedById !== userId && dispute.order.clientId !== userId && dispute.order.freelancer.userId !== userId && req.user.role !== "ADMIN")) {
      return next(new ApiError(404, "Dispute not found or you don’t have access"));
    }

    const comment = await prisma.disputeComment.create({
      data: {
        disputeId: parseInt(disputeId),
        userId,
        content,
      },
      include: { user: { select: { firstname: true, lastname: true } } },
    });

    return res.status(201).json(new ApiResponse(201, comment, "Comment added to dispute successfully"));
  } catch (error) {
    console.error("Error adding dispute comment:", error);
    return next(new ApiError(500, "Failed to add dispute comment", error.message));
  }
};

export { createDispute, updateDisputeStatus, getDispute, getUserDisputes, addDisputeEvidence, addDisputeComment };