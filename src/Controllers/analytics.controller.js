// src/controllers/analyticsController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const getUserAnalytics = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const whereClause = {
      userId,
      status: "COMPLETED",
    };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const [freelancerProfile, transactions, ordersAsClient, ordersAsFreelancer] = await Promise.all([
      prisma.freelancerProfile.findUnique({
        where: { userId },
        select: { totalEarnings: true, rating: true },
      }),
      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { clientId: userId, status: "COMPLETED" },
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
      prisma.order.aggregate({
        where: { freelancer: { userId }, status: "COMPLETED" },
        _count: { id: true },
      }),
    ]);

    const analytics = {
      role: req.user.role,
      totalEarnings: freelancerProfile ? freelancerProfile.totalEarnings : 0,
      averageRating: freelancerProfile ? freelancerProfile.rating : null,
      completedOrdersAsFreelancer: ordersAsFreelancer._count.id,
      completedOrdersAsClient: ordersAsClient._count.id,
      totalSpentAsClient: ordersAsClient._sum.totalPrice || 0,
      totalTransactions: transactions._count.id,
      transactionVolume: transactions._sum.amount || 0,
    };

    return res.status(200).json(new ApiResponse(200, analytics, "User analytics retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving user analytics:", error);
    return next(new ApiError(500, "Failed to retrieve user analytics", error.message));
  }
};

const getPlatformAnalytics = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id || req.user.role !== "ADMIN") {
      return next(new ApiError(403, "Forbidden: Admin access required"));
    }

    const { startDate, endDate } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const [userStats, gigStats, jobStats, orderStats, transactionStats, disputeStats] = await Promise.all([
      prisma.user.aggregate({
        _count: { id: true },
        where: { ...whereClause, isActive: true },
      }),
      prisma.gig.aggregate({
        _count: { id: true },
        where: { ...whereClause, status: "ACTIVE" },
      }),
      prisma.job.aggregate({
        _count: { id: true },
        where: { ...whereClause, isVerified: true },
      }),
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { totalPrice: true },
        where: { ...whereClause, status: "COMPLETED" },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { ...whereClause, status: "COMPLETED" },
      }),
      prisma.dispute.aggregate({
        _count: { id: true },
        where: { ...whereClause, status: { in: ["OPEN", "IN_REVIEW"] } },
      }),
    ]);

    const analytics = {
      totalActiveUsers: userStats._count.id,
      totalActiveGigs: gigStats._count.id,
      totalActiveJobs: jobStats._count.id,
      totalCompletedOrders: orderStats._count.id,
      totalOrderValue: orderStats._sum.totalPrice || 0,
      totalTransactions: transactionStats._count.id,
      totalRevenue: transactionStats._sum.amount || 0,
      activeDisputes: disputeStats._count.id,
    };

    return res.status(200).json(new ApiResponse(200, analytics, "Platform analytics retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving platform analytics:", error);
    return next(new ApiError(500, "Failed to retrieve platform analytics", error.message));
  }
};

// Bonus: Get detailed user analytics (e.g., monthly breakdown)
const getDetailedUserAnalytics = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { startDate, endDate, granularity = "month" } = req.query;

    const whereClause = { userId };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    // Group transactions by granularity (e.g., month)
    const transactionsByPeriod = await prisma.transaction.groupBy({
      by: [granularity === "day" ? "createdAt" : { dateTrunc: { field: "createdAt", interval: granularity } }],
      where: { ...whereClause, status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const formattedTransactions = transactionsByPeriod.map(t => ({
      period: t.createdAt.toISOString().substring(0, granularity === "day" ? 10 : 7), // YYYY-MM-DD or YYYY-MM
      totalAmount: t._sum.amount || 0,
      transactionCount: t._count.id,
    }));

    const ordersAsClientByPeriod = await prisma.order.groupBy({
      by: [granularity === "day" ? "createdAt" : { dateTrunc: { field: "createdAt", interval: granularity } }],
      where: { clientId: userId, status: "COMPLETED" },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const formattedOrdersAsClient = ordersAsClientByPeriod.map(o => ({
      period: o.createdAt.toISOString().substring(0, granularity === "day" ? 10 : 7),
      totalSpent: o._sum.totalPrice || 0,
      orderCount: o._count.id,
    }));

    const analytics = {
      role: req.user.role,
      transactions: formattedTransactions,
      ordersAsClient: formattedOrdersAsClient,
    };

    return res.status(200).json(new ApiResponse(200, analytics, "Detailed user analytics retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving detailed user analytics:", error);
    return next(new ApiError(500, "Failed to retrieve detailed user analytics", error.message));
  }
};

export { getUserAnalytics, getPlatformAnalytics, getDetailedUserAnalytics };