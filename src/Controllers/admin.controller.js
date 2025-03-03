// src/controllers/adminController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const getPlatformStats = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }

    const [userCount, freelancerCount, gigCount, jobCount, orderCount, transactionStats, disputeCount] = await Promise.all([
      prisma.user.count(),
      prisma.freelancerProfile.count(),
      prisma.gig.count({ where: { status: "ACTIVE" } }),
      prisma.job.count({ where: { isVerified: true } }),
      prisma.order.count(),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: "COMPLETED" },
      }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    ]);

    const stats = {
      totalUsers: userCount,
      totalFreelancers: freelancerCount,
      activeGigs: gigCount,
      activeJobs: jobCount,
      totalOrders: orderCount,
      totalTransactions: transactionStats._count.id,
      totalRevenue: transactionStats._sum.amount || 0,
      activeDisputes: disputeCount,
    };

    return res.status(200).json(new ApiResponse(200, stats, "Platform statistics retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving platform stats:", error);
    return next(new ApiError(500, "Failed to retrieve platform stats", error.message));
  }
};

const moderateContent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }
    const adminId = req.user.id;
    const { entityType, entityId, action, reason } = req.body;

    if (!entityType || !entityId || !action) {
      return next(new ApiError(400, "Entity type, entity ID, and action are required"));
    }

    const validActions = ["APPROVE", "REJECT", "DELETE"];
    if (!validActions.includes(action)) {
      return next(new ApiError(400, `Invalid action. Allowed: ${validActions.join(", ")}`));
    }

    let entity;
    switch (entityType.toLowerCase()) {
      case "review":
        entity = await prisma.review.findUnique({ where: { id: parseInt(entityId) } });
        if (!entity) return next(new ApiError(404, "Review not found"));
        if (action === "APPROVE") {
          entity = await prisma.review.update({
            where: { id: parseInt(entityId) },
            data: { moderationStatus: "APPROVED", moderatedAt: new Date(), moderatedBy: adminId },
          });
        } else if (action === "REJECT") {
          entity = await prisma.review.update({
            where: { id: parseInt(entityId) },
            data: { moderationStatus: "REJECTED", moderatedAt: new Date(), moderatedBy: adminId },
          });
        } else if (action === "DELETE") {
          entity = await prisma.review.delete({ where: { id: parseInt(entityId) } });
        }
        break;
      case "message":
        entity = await prisma.message.findUnique({ where: { id: parseInt(entityId) } });
        if (!entity) return next(new ApiError(404, "Message not found"));
        if (action === "APPROVE" || action === "REJECT") {
          entity = await prisma.message.update({
            where: { id: parseInt(entityId) },
            data: { isFlagged: action === "REJECT", flaggedReason: reason || entity.flaggedReason },
          });
        } else if (action === "DELETE") {
          entity = await prisma.message.update({
            where: { id: parseInt(entityId) },
            data: { deletedAt: new Date() },
          });
        }
        break;
      default:
        return next(new ApiError(400, "Unsupported entity type. Allowed: review, message"));
    }

    // Notify affected users (optional)
    if (entityType === "review" && entity.clientId) {
      await prisma.notification.create({
        data: {
          userId: entity.clientId,
          type: "SYSTEM",
          content: `Your review #${entityId} has been ${action.toLowerCase()}${reason ? `: ${reason}` : ""}`,
        },
      });
    }

    return res.status(200).json(new ApiResponse(200, entity, `${entityType} moderated successfully`));
  } catch (error) {
    console.error("Error moderating content:", error);
    return next(new ApiError(500, "Failed to moderate content", error.message));
  }
};

const manageUsers = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }
    const adminId = req.user.id;
    const { userId, action, reason } = req.body;

    if (!userId || !action) {
      return next(new ApiError(400, "User ID and action are required"));
    }

    const validActions = ["BAN", "SUSPEND", "ACTIVATE", "UPDATE_ROLE"];
    if (!validActions.includes(action)) {
      return next(new ApiError(400, `Invalid action. Allowed: ${validActions.join(", ")}`));
    }

    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!targetUser) {
      return next(new ApiError(404, "User not found"));
    }
    if (targetUser.role === "ADMIN" && targetUser.id !== adminId) {
      return next(new ApiError(403, "Cannot modify another admin’s account"));
    }

    let updateData = {};
    switch (action) {
      case "BAN":
        updateData = { isActive: false };
        break;
      case "SUSPEND":
        updateData = { isActive: false }; // Add suspension logic (e.g., suspensionUntil field) if needed
        break;
      case "ACTIVATE":
        updateData = { isActive: true };
        break;
      case "UPDATE_ROLE":
        const { role } = req.body;
        if (!["FREELANCER", "CLIENT", "ADMIN"].includes(role)) {
          return next(new ApiError(400, "Invalid role. Allowed: FREELANCER, CLIENT, ADMIN"));
        }
        updateData = { role };
        break;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData,
      select: { id: true, firstname: true, lastname: true, email: true, role: true, isActive: true },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: parseInt(userId),
        type: "SYSTEM",
        content: `Your account has been ${action.toLowerCase()}${reason ? `: ${reason}` : ""}`,
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedUser, `User ${action.toLowerCase()} successfully`));
  } catch (error) {
    console.error("Error managing user:", error);
    return next(new ApiError(500, "Failed to manage user", error.message));
  }
};

const resolveDisputes = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }
    const adminId = req.user.id;
    const { disputeId } = req.params;
    const { status, resolution } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(disputeId) },
      include: { order: { include: { client: true, freelancer: true } } },
    });
    if (!dispute) {
      return next(new ApiError(404, "Dispute not found"));
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
        resolvedBy: status === "RESOLVED" || status === "CLOSED" ? adminId : dispute.resolvedBy,
      },
      include: { order: { select: { orderNumber: true } }, raisedBy: { select: { firstname: true, lastname: true } } },
    });

    // Notify parties
    await prisma.notification.createMany({
      data: [
        { userId: dispute.raisedById, type: "DISPUTE", content: `Dispute #${disputeId} updated to ${status}${resolution ? `: ${resolution}` : ""}` },
        { userId: dispute.order.clientId === dispute.raisedById ? dispute.order.freelancer.userId : dispute.order.clientId, type: "DISPUTE", content: `Dispute #${disputeId} updated to ${status}${resolution ? `: ${resolution}` : ""}` },
      ],
    });

    // Update order status if resolved (example logic; adjust as needed)
    if (status === "RESOLVED" || status === "CLOSED") {
      await prisma.order.update({
        where: { id: dispute.orderId },
        data: { status: "COMPLETED", statusHistory: { create: { status: "COMPLETED", changedBy: adminId } } },
      });
    }

    return res.status(200).json(new ApiResponse(200, updatedDispute, "Dispute resolved successfully"));
  } catch (error) {
    console.error("Error resolving dispute:", error);
    return next(new ApiError(500, "Failed to resolve dispute", error.message));
  }
};

export { getPlatformStats, moderateContent, manageUsers, resolveDisputes };