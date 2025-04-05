import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const getFreelancerSkills = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;

    const freelancer = await prisma.freelancerProfile.findUnique({
      where: { userId },
      select: { skills: true },
    });
    if (!freelancer) {
      return next(new ApiError(404, "Freelancer profile not found"));
    }

    const skills = freelancer.skills.map((skill, index) => ({ id: index + 1, name: skill }));
    return res.status(200).json(new ApiResponse(200, skills, "Skills retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving skills:", error);
    return next(new ApiError(500, "Failed to retrieve skills", error.message));
  }
};

const getFreelancerSoftware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;

    const software = await prisma.freelancerSoftware.findMany({
      where: { freelancer: { userId } },
      select: { id: true, name: true, icon: true, level: true },
    });

    return res.status(200).json(new ApiResponse(200, software, "Software retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving software:", error);
    return next(new ApiError(500, "Failed to retrieve software", error.message));
  }
};

export { getFreelancerSkills, getFreelancerSoftware };