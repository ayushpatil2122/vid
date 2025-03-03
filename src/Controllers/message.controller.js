// src/controllers/messageController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const sendMessage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const senderId = req.user.id;
    const { receiverId, orderId, content, subject, parentId, attachments } = req.body;

    // Validate required fields
    if (!receiverId || !content) {
      return next(new ApiError(400, "Receiver ID and content are required"));
    }

    // Validate receiver exists
    const receiver = await prisma.user.findUnique({ where: { id: parseInt(receiverId) } });
    if (!receiver) {
      return next(new ApiError(404, "Receiver not found"));
    }

    // Validate order if provided
    let order = null;
    if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: { client: true, freelancer: true },
      });
      if (!order || (order.clientId !== senderId && order.freelancer.userId !== senderId)) {
        return next(new ApiError(404, "Order not found or you don’t have access"));
      }
    }

    // Validate parent message if provided
    if (parentId) {
      const parentMessage = await prisma.message.findUnique({ where: { id: parseInt(parentId) } });
      if (!parentMessage || (parentMessage.senderId !== senderId && parentMessage.receiverId !== senderId)) {
        return next(new ApiError(404, "Parent message not found or you don’t have access"));
      }
    }

    // Handle attachments from req.fileUrls (set by upload middleware)
    const attachmentData = req.fileUrls ? req.fileUrls.map(url => ({
      fileUrl: url,
      fileType: "video/mp4", // Placeholder; adjust based on actual file type
      fileName: url.split("/").pop(),
    })) : [];

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId: parseInt(receiverId),
        orderId: orderId ? parseInt(orderId) : null,
        content,
        subject,
        parentId: parentId ? parseInt(parentId) : null,
        attachments: { create: attachmentData },
      },
      include: { sender: { select: { firstname: true, lastname: true } }, receiver: { select: { firstname: true, lastname: true } }, attachments: true },
    });

    // Notify receiver (optional: integrate with notification controller later)
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: "MESSAGE",
        content: `New message from ${req.user.firstname}: ${subject || content.substring(0, 50)}...`,
      },
    });

    return res.status(201).json(new ApiResponse(201, message, "Message sent successfully"));
  } catch (error) {
    console.error("Error sending message:", error);
    return next(new ApiError(500, "Failed to send message", error.message));
  }
};

const getMessages = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { orderId, receiverId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      OR: [
        { senderId: userId },
        { receiverId: userId },
      ],
      deletedAt: null, // Exclude soft-deleted messages
    };

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: { client: true, freelancer: true },
      });
      if (!order || (order.clientId !== userId && order.freelancer.userId !== userId)) {
        return next(new ApiError(404, "Order not found or you don’t have access"));
      }
      where.orderId = parseInt(orderId);
    }

    if (receiverId) {
      where.AND = [
        {
          OR: [
            { senderId: parseInt(receiverId), receiverId: userId },
            { senderId: userId, receiverId: parseInt(receiverId) },
          ],
        },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: { select: { firstname: true, lastname: true } },
          receiver: { select: { firstname: true, lastname: true } },
          order: { select: { orderNumber: true } },
          attachments: true,
          replies: { include: { sender: { select: { firstname: true, lastname: true } }, attachments: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { sentAt: "desc" },
      }),
      prisma.message.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        messages,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "Messages retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving messages:", error);
    return next(new ApiError(500, "Failed to retrieve messages", error.message));
  }
};

const markMessageAsRead = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });
    if (!message || message.receiverId !== userId) {
      return next(new ApiError(404, "Message not found or you are not the receiver"));
    }
    if (message.isRead) {
      return next(new ApiError(400, "Message is already marked as read"));
    }

    const updatedMessage = await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: { sender: { select: { firstname: true, lastname: true } }, attachments: true },
    });

    return res.status(200).json(new ApiResponse(200, updatedMessage, "Message marked as read successfully"));
  } catch (error) {
    console.error("Error marking message as read:", error);
    return next(new ApiError(500, "Failed to mark message as read", error.message));
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });
    if (!message || (message.senderId !== userId && message.receiverId !== userId)) {
      return next(new ApiError(404, "Message not found or you don’t have access"));
    }
    if (message.deletedAt) {
      return next(new ApiError(400, "Message is already deleted"));
    }

    const updatedMessage = await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: { deletedAt: new Date() },
    });

    return res.status(200).json(new ApiResponse(200, null, "Message deleted successfully"));
  } catch (error) {
    console.error("Error deleting message:", error);
    return next(new ApiError(500, "Failed to delete message", error.message));
  }
};

// Bonus: Flag a message for moderation
const flagMessage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { messageId } = req.params;
    const { reason } = req.body;

    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });
    if (!message || (message.senderId !== userId && message.receiverId !== userId)) {
      return next(new ApiError(404, "Message not found or you don’t have access"));
    }
    if (message.isFlagged) {
      return next(new ApiError(400, "Message is already flagged"));
    }

    const updatedMessage = await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: {
        isFlagged: true,
        flaggedReason: reason || "Not specified",
      },
      include: { sender: { select: { firstname: true, lastname: true } }, receiver: { select: { firstname: true, lastname: true } } },
    });

    // Notify admin (optional: integrate with notification controller)
    await prisma.notification.create({
      data: {
        userId: 1, // Placeholder admin ID; adjust logic
        type: "SYSTEM",
        content: `Message #${messageId} flagged by user ${userId} for: ${reason || "Not specified"}`,
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedMessage, "Message flagged successfully"));
  } catch (error) {
    console.error("Error flagging message:", error);
    return next(new ApiError(500, "Failed to flag message", error.message));
  }
};

export { sendMessage, getMessages, markMessageAsRead, deleteMessage, flagMessage };