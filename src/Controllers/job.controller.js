// src/controllers/jobController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";

const createJob = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const postedById = req.user.id;
    const {
      title, description, category, budgetMin, budgetMax, deadline, jobDifficulty,
      projectLength, keyResponsibilities, requiredSkills, tools, scope, name,
      email, company, note, videoFileUrl,
    } = req.body;

    if (!title || !description || !category || !budgetMin || !budgetMax || !deadline || !jobDifficulty || !projectLength || !requiredSkills || !scope) {
      return next(new ApiError(400, "Missing required fields. Please provide all necessary job details"));
    }

    const minBudget = parseFloat(budgetMin);
    const maxBudget = parseFloat(budgetMax);
    if (isNaN(minBudget) || isNaN(maxBudget) || minBudget < 0 || maxBudget < minBudget) {
      return next(new ApiError(400, "Invalid budget values. Ensure budgetMin is positive and less than budgetMax"));
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime()) || parsedDeadline < new Date()) {
      return next(new ApiError(400, "Invalid deadline. Please provide a future date"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return next(new ApiError(400, "Invalid email format"));
    }

    const job = await prisma.job.create({
      data: {
        title,
        description,
        category: Array.isArray(category) ? category : [category],
        budgetMin: minBudget,
        budgetMax: maxBudget,
        deadline: parsedDeadline,
        jobDifficulty,
        projectLength,
        keyResponsibilities: Array.isArray(keyResponsibilities) ? keyResponsibilities : keyResponsibilities ? [keyResponsibilities] : [],
        requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [requiredSkills],
        tools: Array.isArray(tools) ? tools : tools ? [tools] : [],
        scope,
        postedById,
        name,
        email,
        company,
        note,
        videoFileUrl,
      },
      include: { postedBy: { select: { firstname: true, lastname: true } } },
    });

    return res.status(201).json(new ApiResponse(201, job, "Job posted successfully"));
  } catch (error) {
    console.error("Error creating job:", error);
    return next(new ApiError(500, "Failed to post job", error.message));
  }
};

const updateJob = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { jobId } = req.params;
    const {
      title, description, category, budgetMin, budgetMax, deadline, jobDifficulty,
      projectLength, keyResponsibilities, requiredSkills, tools, scope, name,
      email, company, note, videoFileUrl,
    } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) },
    });
    if (!job || job.postedById !== userId) {
      return next(new ApiError(404, "Job not found or you don’t own it"));
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (category) updateData.category = Array.isArray(category) ? category : [category];
    if (budgetMin !== undefined) {
      const minBudget = parseFloat(budgetMin);
      if (isNaN(minBudget) || minBudget < 0) {
        return next(new ApiError(400, "Invalid budgetMin value"));
      }
      updateData.budgetMin = minBudget;
    }
    if (budgetMax !== undefined) {
      const maxBudget = parseFloat(budgetMax);
      if (isNaN(maxBudget) || maxBudget < (updateData.budgetMin || job.budgetMin)) {
        return next(new ApiError(400, "Invalid budgetMax value; must be greater than budgetMin"));
      }
      updateData.budgetMax = maxBudget;
    }
    if (deadline) {
      const parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime()) || parsedDeadline < new Date()) {
        return next(new ApiError(400, "Invalid deadline. Please provide a future date"));
      }
      updateData.deadline = parsedDeadline;
    }
    if (jobDifficulty) updateData.jobDifficulty = jobDifficulty;
    if (projectLength) updateData.projectLength = projectLength;
    if (keyResponsibilities) updateData.keyResponsibilities = Array.isArray(keyResponsibilities) ? keyResponsibilities : keyResponsibilities ? [keyResponsibilities] : [];
    if (requiredSkills) updateData.requiredSkills = Array.isArray(requiredSkills) ? requiredSkills : [requiredSkills];
    if (tools) updateData.tools = Array.isArray(tools) ? tools : tools ? [tools] : [];
    if (scope) updateData.scope = scope;
    if (name) updateData.name = name;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new ApiError(400, "Invalid email format"));
      }
      updateData.email = email;
    }
    if (company !== undefined) updateData.company = company;
    if (note !== undefined) updateData.note = note;
    if (videoFileUrl !== undefined) updateData.videoFileUrl = videoFileUrl;

    const updatedJob = await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: updateData,
      include: { postedBy: { select: { firstname: true, lastname: true } } },
    });

    return res.status(200).json(new ApiResponse(200, updatedJob, "Job updated successfully"));
  } catch (error) {
    console.error("Error updating job:", error);
    return next(new ApiError(500, "Failed to update job", error.message));
  }
};

const deleteJob = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) },
    });
    if (!job || job.postedById !== userId) {
      return next(new ApiError(404, "Job not found or you don’t own it"));
    }

    await prisma.job.delete({
      where: { id: parseInt(jobId) },
    });

    return res.status(200).json(new ApiResponse(200, null, "Job deleted successfully"));
  } catch (error) {
    console.error("Error deleting job:", error);
    return next(new ApiError(500, "Failed to delete job", error.message));
  }
};

const getJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) },
      include: { postedBy: { select: { firstname: true, lastname: true, email: true } } },
    });
    if (!job) {
      return next(new ApiError(404, "Job not found"));
    }

    // Increment proposals counter if viewed by a freelancer (optional logic)
    if (req.user && req.user.role === "FREELANCER" && req.user.id !== job.postedById) {
      await prisma.job.update({
        where: { id: parseInt(jobId) },
        data: { proposals: { increment: 1 } },
      });
    }

    return res.status(200).json(new ApiResponse(200, job, "Job retrieved successfully"));
  } catch (error) {
    console.error("Error retrieving job:", error);
    return next(new ApiError(500, "Failed to retrieve job", error.message));
  }
};

const getClientJobs = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const postedById = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { postedById };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { postedBy: { select: { firstname: true, lastname: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        jobs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "Client jobs retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving client jobs:", error);
    return next(new ApiError(500, "Failed to retrieve client jobs", error.message));
  }
};

const getAllJobs = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isVerified: true, // Only show verified jobs
    };
    if (category) {
      where.category = { has: category };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { scope: { contains: search, mode: "insensitive" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { postedBy: { select: { firstname: true, lastname: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        jobs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }, "All jobs retrieved successfully")
    );
  } catch (error) {
    console.error("Error retrieving all jobs:", error);
    return next(new ApiError(500, "Failed to retrieve all jobs", error.message));
  }
};

export { createJob, updateJob, deleteJob, getJob, getClientJobs, getAllJobs };