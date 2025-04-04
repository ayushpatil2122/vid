import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import { hashPassword, comparePasswords } from "../Services/authService.js";
import jwt from "jsonwebtoken";
import { isFreelancerProfileComplete } from "../Utils/profileUtils.js";

const generateJwt = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "your_jwt_secret",
    { expiresIn: "7d" }
  );
};

// Register a new user
const registerUser = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password, country, role, company, companyEmail } = req.body;

    console.log("Received registration data:", req.body);

    if (!firstname || !lastname || !email || !password || !country || !role) {
      console.log("Missing fields:", { firstname, lastname, email, password, country, role });
      return next(new ApiError(400, "All fields (firstname, lastname, email, password, country, role) are required"));
    }

    const validRoles = ["FREELANCER", "CLIENT", "ADMIN"];
    if (!validRoles.includes(role)) {
      return next(new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(", ")}`));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new ApiError(400, "A user with this email already exists"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new ApiError(400, "Invalid email format"));
    }
    if (companyEmail && !emailRegex.test(companyEmail)) {
      return next(new ApiError(400, "Invalid company email format"));
    }

    const hashedPassword = await hashPassword(password);
    let newUser;

    if (role === "FREELANCER") {
      newUser = await prisma.user.create({
        data: {
          firstname,
          lastname,
          email,
          password: hashedPassword,
          country,
          role,
          company: company || null,
          companyEmail: companyEmail || null,
          isProfileComplete: false,
          freelancerProfile: {
            create: {},
          },
        },
        include: { freelancerProfile: true },
      });
    } else {
      newUser = await prisma.user.create({
        data: {
          firstname,
          lastname,
          email,
          password: hashedPassword,
          country,
          role,
          company: company || null,
          companyEmail: companyEmail || null,
          isProfileComplete: true,
        },
      });
    }

    const token = generateJwt(newUser);
    const userResponse = {
      id: newUser.id,
      firstname: newUser.firstname,
      lastname: newUser.lastname,
      email: newUser.email,
      country: newUser.country,
      role: newUser.role,
      company: newUser.company,
      companyEmail: newUser.companyEmail,
      isProfileComplete: newUser.isProfileComplete,
      freelancerProfile: newUser.freelancerProfile || null,
    };

    return res.status(201).json(new ApiResponse(201, { user: userResponse, token }, "User registered successfully"));
  } catch (error) {
    console.error("Error registering user:", error.message, error.stack);
    return next(new ApiError(500, "Failed to register user", error.message));
  }
};

// Login an existing user
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ApiError(400, "Email and password are required"));
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { freelancerProfile: true },
    });
    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or account is deactivated"));
    }

    const isPasswordValid = await comparePasswords(password, user.password);
    if (!isPasswordValid) {
      return next(new ApiError(401, "Invalid credentials"));
    }

    const token = generateJwt(user);
    const userResponse = {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      country: user.country,
      role: user.role,
      company: user.company,
      companyEmail: user.companyEmail,
      isProfileComplete: user.isProfileComplete,
      freelancerProfile: user.freelancerProfile || null,
    };

    return res.status(200).json(new ApiResponse(200, { user: userResponse, token }, "Login successful"));
  } catch (error) {
    console.error("Error logging in user:", error);
    return next(new ApiError(500, "Failed to login user", error.message));
  }
};

// Fetch current user's profile
const getUserProfile = async (req, res, next) => {
  try {
    console.log("getUserProfile: req.user:", req.user);
    if (!req.user || !req.user.id) {
      console.log("getUserProfile: No user ID from token");
      return next(new ApiError(401, "Unauthorized: No user ID provided"));
    }

    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        country: true,
        username: true,
        role: true,
        profilePicture: true,
        bio: true,
        isActive: true,
        isProfileComplete: true,
        createdAt: true,
        company: true,
        companyEmail: true,
        freelancerProfile: {
          select: {
            id: true,
            city: true,
            state: true,
            pinCode: true,
            jobTitle: true,
            overview: true,
            skills: true,
            languages: true,
            socialLinks: true,
            tools: true,
            equipmentCameras: true,
            equipmentLenses: true,
            equipmentLighting: true,
            equipmentOther: true,
            certifications: true,
            minimumRate: true,
            maximumRate: true,
            hourlyRate: true,
            weeklyHours: true,
            availabilityStatus: true,
            experienceLevel: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    console.log("getUserProfile: Queried user:", user);

    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or account is deactivated"));
    }

    return res.status(200).json(new ApiResponse(200, user, "User profile fetched successfully"));
  } catch (error) {
    console.error("Error fetching user profile:", error.message, error.stack);
    return next(new ApiError(500, "Failed to fetch user profile", error.message));
  }
};

// Update user profile
const updateUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const {
      firstname,
      lastname,
      email,
      country,
      password,
      username,
      bio,
      company,
      companyEmail,
      city,
      pinCode,
      state,
      jobTitle,
      overview,
      skills,
      languages,
      socialLinks,
      tools,
      equipmentCameras,
      equipmentLenses,
      equipmentLighting,
      equipmentOther,
      certifications,
      minimumRate,
      maximumRate,
      hourlyRate,
      weeklyHours,
      availabilityStatus,
      experienceLevel,
    } = req.body;
    const profilePicture = req.fileUrl || req.body.profilePicture; // Use S3 URL or body value

    console.log("Update payload:", req.body, "File URL:", profilePicture);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { freelancerProfile: true },
    });
    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or account is deactivated"));
    }

    const userUpdateData = {};
    if (firstname) userUpdateData.firstname = firstname;
    if (lastname) userUpdateData.lastname = lastname;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new ApiError(400, "Invalid email format"));
      }
      if (email !== user.email && (await prisma.user.findUnique({ where: { email } }))) {
        return next(new ApiError(400, "Email is already in use"));
      }
      userUpdateData.email = email;
    }
    if (country) userUpdateData.country = country;
    if (password) userUpdateData.password = await hashPassword(password);
    if (username) {
      if (username !== user.username && (await prisma.user.findUnique({ where: { username } }))) {
        return next(new ApiError(400, "Username is already in use"));
      }
      userUpdateData.username = username;
    }
    if (bio !== undefined) userUpdateData.bio = bio;
    if (company !== undefined) userUpdateData.company = company;
    if (companyEmail !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (companyEmail && !emailRegex.test(companyEmail)) {
        return next(new ApiError(400, "Invalid company email format"));
      }
      if (companyEmail && companyEmail !== user.companyEmail && (await prisma.user.findFirst({ where: { companyEmail } }))) {
        return next(new ApiError(400, "Company email is already in use"));
      }
      userUpdateData.companyEmail = companyEmail;
    }
    if (profilePicture !== undefined) userUpdateData.profilePicture = profilePicture;

    let freelancerProfileUpdateData = {};
    if (user.role === "FREELANCER") {
      freelancerProfileUpdateData = {
        city: city !== undefined ? city : user.freelancerProfile?.city,
        pinCode: pinCode !== undefined ? pinCode : user.freelancerProfile?.pinCode,
        state: state !== undefined ? state : user.freelancerProfile?.state,
        jobTitle: jobTitle !== undefined ? jobTitle : user.freelancerProfile?.jobTitle,
        overview: overview !== undefined ? overview : user.freelancerProfile?.overview,
        skills: skills !== undefined ? skills : user.freelancerProfile?.skills,
        languages: languages !== undefined ? languages : user.freelancerProfile?.languages,
        socialLinks: socialLinks !== undefined ? socialLinks : user.freelancerProfile?.socialLinks,
        tools: tools !== undefined ? tools : user.freelancerProfile?.tools,
        equipmentCameras: equipmentCameras !== undefined ? equipmentCameras : user.freelancerProfile?.equipmentCameras,
        equipmentLenses: equipmentLenses !== undefined ? equipmentLenses : user.freelancerProfile?.equipmentLenses,
        equipmentLighting: equipmentLighting !== undefined ? equipmentLighting : user.freelancerProfile?.equipmentLighting,
        equipmentOther: equipmentOther !== undefined ? equipmentOther : user.freelancerProfile?.equipmentOther,
        certifications: certifications !== undefined ? certifications : user.freelancerProfile?.certifications,
        minimumRate: minimumRate !== undefined ? parseFloat(minimumRate) : user.freelancerProfile?.minimumRate,
        maximumRate: maximumRate !== undefined ? parseFloat(maximumRate) : user.freelancerProfile?.maximumRate,
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : user.freelancerProfile?.hourlyRate,
        weeklyHours: weeklyHours !== undefined ? parseInt(weeklyHours) : user.freelancerProfile?.weeklyHours,
        availabilityStatus: availabilityStatus !== undefined ? availabilityStatus : user.freelancerProfile?.availabilityStatus,
        experienceLevel: experienceLevel !== undefined ? experienceLevel : user.freelancerProfile?.experienceLevel,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userUpdateData,
        freelancerProfile: user.role === "FREELANCER" && Object.keys(freelancerProfileUpdateData).length > 0 ? {
          upsert: {
            update: freelancerProfileUpdateData,
            create: freelancerProfileUpdateData,
          },
        } : undefined,
      },
      include: { freelancerProfile: true },
    });

    if (user.role === "FREELANCER") {
      const isComplete = !!isFreelancerProfileComplete(updatedUser.freelancerProfile); // Ensure boolean
      if (isComplete !== updatedUser.isProfileComplete) {
        await prisma.user.update({
          where: { id: userId },
          data: { isProfileComplete: isComplete },
        });
        updatedUser.isProfileComplete = isComplete;
      }
    }

    if (Object.keys(userUpdateData).length === 0 && Object.keys(freelancerProfileUpdateData).length === 0) {
      return next(new ApiError(400, "No valid fields provided for update"));
    }

    const userResponse = {
      id: updatedUser.id,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      country: updatedUser.country,
      username: updatedUser.username,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      isActive: updatedUser.isActive,
      isProfileComplete: updatedUser.isProfileComplete,
      createdAt: updatedUser.createdAt,
      company: updatedUser.company,
      companyEmail: updatedUser.companyEmail,
      freelancerProfile: updatedUser.freelancerProfile,
    };

    return res.status(200).json(new ApiResponse(200, userResponse, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error);
    return next(new ApiError(500, "Failed to update user", error.message));
  }
};

// Deactivate user account
const deleteUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or already deactivated"));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    console.log(`User ${userId} deactivated at ${new Date().toISOString()}`);
    return res.status(200).json(new ApiResponse(200, null, "User account deactivated successfully"));
  } catch (error) {
    console.error("Error deleting user:", error);
    return next(new ApiError(500, "Failed to delete user", error.message));
  }
};

export { registerUser, loginUser, getUserProfile, updateUser, deleteUser };