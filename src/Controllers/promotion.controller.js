// src/controllers/promotionController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import crypto from "crypto";

const generatePromoCode = () => {
  return `VID${crypto.randomBytes(4).toString("hex").toUpperCase()}`; // e.g., "VIDABCD1234"
};

const createPromoCode = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }
    const userId = req.user.id;
    const { discountAmount, discountType, maxUses, expiresAt } = req.body;

    if (!discountAmount || !discountType) {
      return next(new ApiError(400, "Discount amount and type are required"));
    }

    const validDiscountTypes = ["PERCENTAGE", "FIXED"];
    if (!validDiscountTypes.includes(discountType)) {
      return next(new ApiError(400, `Invalid discount type. Allowed: ${validDiscountTypes.join(", ")}`));
    }
    const amount = parseFloat(discountAmount);
    if (isNaN(amount) || amount <= 0 || (discountType === "PERCENTAGE" && amount > 100)) {
      return next(new ApiError(400, "Invalid discount amount"));
    }

    const code = generatePromoCode();
    const promotion = await prisma.promotion.create({
      data: {
        type: "PROMO_CODE",
        code,
        discountAmount: amount,
        discountType,
        userId,
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return res.status(201).json(new ApiResponse(201, promotion, "Promo code created successfully"));
  } catch (error) {
    console.error("Error creating promo code:", error);
    return next(new ApiError(500, "Failed to create promo code", error.message));
  }
};

const redeemPromoCode = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { code, orderId } = req.body;

    if (!code || !orderId) {
      return next(new ApiError(400, "Promo code and order ID are required"));
    }

    const promotion = await prisma.promotion.findUnique({
      where: { code },
    });
    if (!promotion || promotion.type !== "PROMO_CODE") {
      return next(new ApiError(404, "Invalid promo code"));
    }
    if (promotion.status !== "ACTIVE" || (promotion.expiresAt && promotion.expiresAt < new Date())) {
      return next(new ApiError(400, "Promo code is expired or disabled"));
    }
    if (promotion.maxUses && promotion.uses >= promotion.maxUses) {
      return next(new ApiError(400, "Promo code has reached its usage limit"));
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
    });
    if (!order || order.clientId !== userId) {
      return next(new ApiError(404, "Order not found or you don’t own it"));
    }
    if (order.status !== "PENDING") {
      return next(new ApiError(400, "Promo code can only be applied to pending orders"));
    }

    const discount = promotion.discountType === "PERCENTAGE"
      ? order.totalPrice * (promotion.discountAmount / 100)
      : Math.min(promotion.discountAmount, order.totalPrice);

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { totalPrice: Math.max(order.totalPrice - discount, 0) },
    });

    await prisma.promotion.update({
      where: { code },
      data: { uses: { increment: 1 } },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        content: `Promo code ${code} applied! You saved $${discount.toFixed(2)} on order #${orderId}`,
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedOrder, "Promo code redeemed successfully"));
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return next(new ApiError(500, "Failed to redeem promo code", error.message));
  }
};

const featureListing = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { entityType, entityId, durationDays } = req.body;

    if (!entityType || !entityId || !durationDays) {
      return next(new ApiError(400, "Entity type, entity ID, and duration are required"));
    }

    const validEntityTypes = ["GIG", "JOB"];
    if (!validEntityTypes.includes(entityType)) {
      return next(new ApiError(400, `Invalid entity type. Allowed: ${validEntityTypes.join(", ")}`));
    }

    let entity;
    if (entityType === "GIG") {
      entity = await prisma.gig.findUnique({
        where: { id: parseInt(entityId) },
        include: { freelancer: true },
      });
      if (!entity || entity.freelancer.userId !== userId) {
        return next(new ApiError(404, "Gig not found or you don’t own it"));
      }
    } else {
      entity = await prisma.job.findUnique({
        where: { id: parseInt(entityId) },
      });
      if (!entity || entity.postedById !== userId) {
        return next(new ApiError(404, "Job not found or you don’t own it"));
      }
    }

    // Check payment (simplified; integrate with transactionController.js in production)
    const costPerDay = 5; // $5/day for featured listing; adjust as needed
    const totalCost = costPerDay * parseInt(durationDays);

    const promotion = await prisma.promotion.create({
      data: {
        type: "FEATURED_LISTING",
        entityType,
        entityId: parseInt(entityId),
        userId,
        expiresAt: new Date(Date.now() + parseInt(durationDays) * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        content: `Your ${entityType.toLowerCase()} #${entityId} is now featured for ${durationDays} days! Cost: $${totalCost}`,
      },
    });

    return res.status(201).json(new ApiResponse(201, promotion, `${entityType} featured successfully`));
  } catch (error) {
    console.error("Error featuring listing:", error);
    return next(new ApiError(500, "Failed to feature listing", error.message));
  }
};

const getPromotions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId };
    if (type) {
      const validTypes = ["PROMO_CODE", "FEATURED_LISTING"];
      if (!validTypes.includes(type)) {
        return next(new ApiError(400, `Invalid type. Allowed: ${validTypes.join(", ")}`));
      }
      where.type = type;
    }

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.promotion.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        promotions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "Promotions retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving promotions:", error);
    return next(new ApiError(500, "Failed to retrieve promotions", error.message));
  }
};

export { createPromoCode, redeemPromoCode, featureListing, getPromotions };