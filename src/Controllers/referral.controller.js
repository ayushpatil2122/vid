// src/controllers/referralController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import crypto from "crypto";

const generateReferralCode = (userId) => {
  const prefix = "VID";
  const randomString = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${userId}${randomString}`; // e.g., "VID123ABCD"
};

const createReferral = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const referrerId = req.user.id;
    const { rewardAmount } = req.body;

    // Optional: Limit reward amount (e.g., admin-configurable max)
    const defaultReward = 10; // $10 default reward; adjust as needed
    const finalReward = rewardAmount ? Math.min(parseFloat(rewardAmount), 50) : defaultReward; // Cap at $50

    const referralCode = generateReferralCode(referrerId);

    const existingReferral = await prisma.referral.findUnique({
      where: { referralCode },
    });
    if (existingReferral) {
      return next(new ApiError(500, "Referral code collision; please try again"));
    }

    const referral = await prisma.referral.create({
      data: {
        referrerId,
        referralCode,
        rewardAmount: finalReward,
      },
      include: { referrer: { select: { firstname: true, lastname: true } } },
    });

    return res.status(201).json(new ApiResponse(201, referral, "Referral created successfully"));
  } catch (error) {
    console.error("Error creating referral:", error);
    return next(new ApiError(500, "Failed to create referral", error.message));
  }
};

const redeemReferral = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const refereeId = req.user.id;
    const { referralCode } = req.body;

    if (!referralCode) {
      return next(new ApiError(400, "Referral code is required"));
    }

    const referral = await prisma.referral.findUnique({
      where: { referralCode },
      include: { referrer: true },
    });
    if (!referral) {
      return next(new ApiError(404, "Invalid referral code"));
    }
    if (referral.status !== "PENDING") {
      return next(new ApiError(400, "Referral code has already been redeemed or expired"));
    }
    if (referral.referrerId === refereeId) {
      return next(new ApiError(400, "You cannot redeem your own referral code"));
    }
    if (await prisma.referral.findFirst({ where: { refereeId } })) {
      return next(new ApiError(400, "You have already redeemed a referral code"));
    }

    const updatedReferral = await prisma.referral.update({
      where: { referralCode },
      data: {
        refereeId,
        status: "REDEEMED",
        redeemedAt: new Date(),
      },
      include: { referrer: { select: { firstname: true, lastname: true } }, referee: { select: { firstname: true, lastname: true } } },
    });

    // Award referrer (e.g., credit to totalEarnings)
    await prisma.freelancerProfile.update({
      where: { userId: referral.referrerId },
      data: { totalEarnings: { increment: referral.rewardAmount } },
    });

    // Notify both parties
    await prisma.notification.createMany({
      data: [
        { userId: referral.referrerId, type: "SYSTEM", content: `Your referral code ${referralCode} was redeemed! You earned $${referral.rewardAmount}` },
        { userId: refereeId, type: "SYSTEM", content: `You successfully redeemed referral code ${referralCode}` },
      ],
    });

    return res.status(200).json(new ApiResponse(200, updatedReferral, "Referral redeemed successfully"));
  } catch (error) {
    console.error("Error redeeming referral:", error);
    return next(new ApiError(500, "Failed to redeem referral", error.message));
  }
};

const getReferralStats = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { referrerId: userId };

    const [referrals, total, stats] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referrer: { select: { firstname: true, lastname: true } },
          referee: { select: { firstname: true, lastname: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.referral.count({ where }),
      prisma.referral.aggregate({
        where,
        _count: { id: true },
        _sum: { rewardAmount: true },
        _count: { status: { equals: "REDEEMED" } },
      }),
    ]);

    const analytics = {
      totalReferrals: stats._count.id,
      totalRedeemed: stats._count.status || 0,
      totalRewardsEarned: stats._sum.rewardAmount || 0,
      referrals,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };

    return res.status(200).json(new ApiResponse(200, analytics, "Referral stats retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving referral stats:", error);
    return next(new ApiError(500, "Failed to retrieve referral stats", error.message));
  }
};

export { createReferral, redeemReferral, getReferralStats };