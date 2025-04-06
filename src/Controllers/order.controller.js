// src/controllers/orderController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const createOrder = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const clientId = req.user.id;
      const { gigId, selectedPackage, requirements, isUrgent, customDetails } = req.body;
  
      // Validate required fields
      if (!gigId || !selectedPackage) {
        return next(new ApiError(400, "Gig ID and package are required"));
      }
  
      const gig = await prisma.gig.findUnique({
        where: { id: parseInt(gigId) },
        include: { freelancer: true },
      });
      if (!gig || gig.status !== "ACTIVE") {
        return next(new ApiError(404, "Gig not found or not active"));
      }
  
      const pricing = gig.pricing[selectedPackage];
      if (!pricing) {
        return next(new ApiError(400, "Invalid package selected"));
      }
  
      const totalPrice = isUrgent ? pricing * 1.5 : pricing; // Example: 50% premium for urgent
      const orderNumber = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`; // Fixed string interpolation
  
      const order = await prisma.order.create({
        data: {
          gigId: gig.id,
          clientId,
          freelancerId: gig.freelancerId,
          package: selectedPackage, // Updated field name in schema usage
          totalPrice,
          requirements,
          isUrgent: isUrgent || false,
          priorityFee: isUrgent ? pricing * 0.5 : null,
          customDetails,
          orderNumber,
          deliveryDeadline: new Date(Date.now() + gig.deliveryTime * 24 * 60 * 60 * 1000), // Days to milliseconds
          statusHistory: { create: { status: "PENDING" } },
        },
        include: { gig: true, freelancer: { include: { user: true } }, statusHistory: true },
      });
  
      return res.status(201).json(new ApiResponse(201, order, "Order created successfully"));
    } catch (error) {
      console.error("Error creating order:", error);
      return next(new ApiError(500, "Failed to create order", error.message));
    }
  };
  
  // Rest of the functions (updateOrderStatus, getOrder, etc.) remain unaffected since they don’t use 'package' directly in destructuring
  // However, ensure schema field 'package' is referenced correctly elsewhere
  
  const updateOrderStatus = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const userId = req.user.id;
      const { orderId } = req.params;
      const { status, extensionReason } = req.body;
  
      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: { client: true, freelancer: true },
      });
      if (!order) {
        return next(new ApiError(404, "Order not found"));
      }
  
      const isClient = order.clientId === userId;
      const isFreelancer = order.freelancer.userId === userId;
      if (!isClient && !isFreelancer) {
        return next(new ApiError(403, "Forbidden: You can only update your own orders"));
      }
  
      const validTransitions = {
        PENDING: ["ACCEPTED", "CANCELLED"],
        ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
        IN_PROGRESS: ["DELIVERED", "CANCELLED"],
        DELIVERED: ["COMPLETED", "DISPUTED"],
        DISPUTED: ["COMPLETED", "CANCELLED"],
      };
      if (!status || (order.status !== "COMPLETED" && !validTransitions[order.status]?.includes(status))) {
        return next(new ApiError(400, `Invalid status transition from ${order.status} to ${status}`)); // Fixed template literal syntax
      }
  
      const updateData = { status };
      if (status === "CANCELLED") {
        updateData.cancellationReason = req.body.cancellationReason || "Not specified";
        updateData.cancellationDate = new Date();
      } else if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (extensionReason) {
        updateData.deliveryExtensions = { increment: 1 };
        updateData.extensionReason = extensionReason;
        updateData.deliveryDeadline = new Date(order.deliveryDeadline.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
  
      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: {
          ...updateData,
          statusHistory: { create: { status, changedBy: userId } },
        },
        include: { statusHistory: true },
      });
  
      return res.status(200).json(new ApiResponse(200, updatedOrder, "Order status updated successfully"));
    } catch (error) {
      console.error("Error updating order status:", error);
      return next(new ApiError(500, "Failed to update order status", error.message));
    }
  };
  const getOrder = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const userId = req.user.id;
      const { orderId } = req.params;
  
      if (!orderId || isNaN(parseInt(orderId))) {
        return next(new ApiError(400, "Valid orderId is required"));
      }
  
      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          gig: true,
          client: { select: { firstname: true, lastname: true, email: true } },
          freelancer: { include: { user: { select: { firstname: true, lastname: true, email: true } } } },
          transactions: true,
          review: true,
          messages: true,
          dispute: true,
          statusHistory: true,
        },
      });
      if (!order) {
        return next(new ApiError(404, "Order not found"));
      }
      if (order.clientId !== userId && order.freelancer.userId !== userId) {
        return next(new ApiError(403, "Forbidden: You can only view your own orders"));
      }
  
      return res.status(200).json(new ApiResponse(200, order, "Order retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving order:", error);
      return next(new ApiError(500, "Failed to retrieve order", error.message));
    }
  };

  const getClientOrders = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const clientId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
  
      const where = { clientId };
      if (status) where.status = status;
  
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            gig: true,
            freelancer: { include: { user: { select: { firstname: true, lastname: true } } } }, // Fixed
          },
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.count({ where }),
      ]);
  
      return res.status(200).json(
        new ApiResponse(200, {
          orders,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        }, "Client orders retrieved successfully")
      );
    } catch (error) {
      console.error("Error retrieving client orders:", error);
      return next(new ApiError(500, "Failed to retrieve client orders", error.message));
    }
  };

  const getFreelancerOrders = async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, "Unauthorized: User not authenticated"));
      }
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
  
      const freelancer = await prisma.freelancerProfile.findUnique({ where: { userId } });
      if (!freelancer) {
        return next(new ApiError(404, "Freelancer profile not found"));
      }
  
      const where = { freelancerId: freelancer.id };
      if (status) where.status = status;
  
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            gig: true,
            client: { select: { firstname: true, lastname: true } }, // Fixed
          },
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.count({ where }),
      ]);
  
      return res.status(200).json(
        new ApiResponse(200, {
          orders,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        }, "Freelancer orders retrieved successfully")
      );
    } catch (error) {
      console.error("Error retrieving freelancer orders:", error);
      return next(new ApiError(500, "Failed to retrieve freelancer orders", error.message));
    }
  };

const cancelOrder = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { client: true, freelancer: true },
    });
    if (!order) {
      return next(new ApiError(404, "Order not found"));
    }
    if (order.clientId !== userId && order.freelancer.userId !== userId) {
      return next(new ApiError(403, "Forbidden: You can only cancel your own orders"));
    }
    if (!["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      return next(new ApiError(400, "Order cannot be cancelled in its current status"));
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: {
        status: "CANCELLED",
        cancellationReason: cancellationReason || "Not specified",
        cancellationDate: new Date(),
        statusHistory: { create: { status: "CANCELLED", changedBy: userId } },
      },
      include: { statusHistory: true },
    });

    return res.status(200).json(new ApiResponse(200, updatedOrder, "Order cancelled successfully"));
  } catch (error) {
    console.error("Error cancelling order:", error);
    return next(new ApiError(500, "Failed to cancel order", error.message));
  }
};

// ... (keep existing imports and functions)

// Add these new functions after existing ones
const getCurrentOrders = async (req, res, next) => {
  try {
    console.log(`Fetching current orders for user: ${req.user?.id}`);
    if (!req.user || !req.user.id) {
      throw new ApiError(401, "Unauthorized: User not authenticated");
    }
    const userId = req.user.id;

    const freelancer = await prisma.freelancerProfile.findUnique({ where: { userId } });
    console.log(`FreelancerProfile for user ${userId}:`, freelancer);
    if (!freelancer) {
      throw new ApiError(404, "Freelancer profile not found for this user");
    }

    const orders = await prisma.order.findMany({
      where: {
        freelancerId: freelancer.id,
        status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      },
      include: {
        gig: true,
        client: { select: { firstname: true, lastname: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.log(`Current orders found for freelancer ${freelancer.id}:`, orders.length);

    const ordersWithDaysLeft = orders.map(order => ({
      ...order,
      daysLeft: order.deliveryDeadline
        ? Math.max(0, Math.ceil((new Date(order.deliveryDeadline) - new Date()) / (1000 * 60 * 60 * 24)))
        : null,
    }));

    return res.status(200).json(new ApiResponse(200, ordersWithDaysLeft, "Current orders retrieved successfully"));
  } catch (error) {
    console.error(`Error in getCurrentOrders for user ${req.user?.id}:`, error);
    return next(new ApiError(500, "Failed to retrieve current orders", error.message));
  }
};

const getPendingOrders = async (req, res, next) => {
  console.log("Entering getPendingOrders for user:", req.user?.id); // Debug log
  try {
    console.log(`Fetching pending orders for user: ${req.user?.id}`);
    if (!req.user || !req.user.id) {
      throw new ApiError(401, "Unauthorized: User not authenticated");
    }
    const userId = req.user.id;

    const freelancer = await prisma.freelancerProfile.findUnique({ where: { userId } });
    console.log(`FreelancerProfile for user ${userId}:`, freelancer);
    if (!freelancer) {
      return res.status(200).json(new ApiResponse(200, [], "No freelancer profile found, no pending orders"));
    }

    const orders = await prisma.order.findMany({
      where: {
        freelancerId: freelancer.id,
        status: "PENDING",
      },
      include: {
        gig: true,
        client: { select: { firstname: true, lastname: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.log(`Pending orders found for freelancer ${freelancer.id}:`, orders.length);

    const ordersWithDaysLeft = orders.map(order => ({
      ...order,
      daysLeft: order.deliveryDeadline
        ? Math.max(0, Math.ceil((new Date(order.deliveryDeadline) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0,
    }));

    return res.status(200).json(new ApiResponse(200, ordersWithDaysLeft, "Pending orders retrieved successfully"));
  } catch (error) {
    console.error(`Error in getPendingOrders for user ${req.user?.id}:`, error.stack);
    return next(new ApiError(500, "Failed to retrieve pending orders", error.message));
  }
};

const getCompletedOrders = async (req, res, next) => {
  try {
    console.log(`Fetching completed orders for user: ${req.user?.id}`);
    if (!req.user || !req.user.id) {
      throw new ApiError(401, "Unauthorized: User not authenticated");
    }
    const userId = req.user.id;

    const freelancer = await prisma.freelancerProfile.findUnique({ where: { userId } });
    console.log(`FreelancerProfile for user ${userId}:`, freelancer);
    if (!freelancer) {
      throw new ApiError(404, "Freelancer profile not found for this user");
    }

    const orders = await prisma.order.findMany({
      where: {
        freelancerId: freelancer.id,
        status: "COMPLETED",
      },
      include: {
        gig: true,
        client: { select: { firstname: true, lastname: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.log(`Completed orders found for freelancer ${freelancer.id}:`, orders.length);

    const ordersWithDaysLeft = orders.map(order => ({
      ...order,
      daysLeft: order.deliveryDeadline
        ? Math.max(0, Math.ceil((new Date(order.deliveryDeadline) - new Date()) / (1000 * 60 * 60 * 24)))
        : null,
    }));

    return res.status(200).json(new ApiResponse(200, ordersWithDaysLeft, "Completed orders retrieved successfully"));
  } catch (error) {
    console.error(`Error in getCompletedOrders for user ${req.user?.id}:`, error);
    return next(new ApiError(500, "Failed to retrieve completed orders", error.message));
  }
};

// Update export
export {
  createOrder,
  updateOrderStatus,
  getOrder,
  getClientOrders,
  getFreelancerOrders,
  cancelOrder,
  getCurrentOrders,
  getPendingOrders,
  getCompletedOrders,
};