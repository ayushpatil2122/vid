import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const getPortfolioStats = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;

    const freelancer = await prisma.freelancerProfile.findUnique({ where: { userId } });
    if (!freelancer) {
      return next(new ApiError(404, "Freelancer profile not found"));
    }

    const videos = await prisma.portfolioVideo.findMany({
      where: { freelancerId: freelancer.id },
      orderBy: { views: "desc" },
    });

    const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
    const popular = videos.slice(0, 3).map(video => ({
      id: video.id,
      title: video.title || "Untitled",
      views: video.views,
      category: video.category || "Uncategorized",
      videoUrl: video.videoUrl,
    }));

    const metrics = [
      { id: 1, name: "Total Views", value: totalViews.toString(), percentage: 100, trend: "up" },
      { id: 2, name: "Portfolio Items", value: videos.length.toString(), percentage: Math.min(videos.length * 10, 100), trend: "up" },
    ];

    const portfolioStats = { popular, metrics };
    return res.status(200).json(new ApiResponse(200, portfolioStats, "Portfolio stats retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving portfolio stats:", error);
    return next(new ApiError(500, "Failed to retrieve portfolio stats", error.message));
  }
};

export { getPortfolioStats };