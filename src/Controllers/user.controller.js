// src/controllers/userController.js
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import prisma from "../prismaClient.js";
import { hashPassword, comparePasswords } from "../Services/authService.js";
import jwt from "jsonwebtoken";

const generateJwt = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "your_jwt_secret",
    { expiresIn: "7d" }
  );
};

const registerUser = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password, country, role } = req.body;

    console.log("Received registration data:", req.body); // Debug payload

    // Check all required fields, including role
    if (!firstname || !lastname || !email || !password || !country || !role) {
      console.log("Missing fields:", { firstname, lastname, email, password, country, role }); // Debug which field is missing
      return next(new ApiError(400, "All fields (firstname, lastname, email, password, country, role) are required"));
    }

    // Validate role against enum
    const validRoles = ['FREELANCER', 'CLIENT', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return next(new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new ApiError(400, "A user with this email already exists"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new ApiError(400, "Invalid email format"));
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        firstname,
        lastname,
        email,
        password: hashedPassword,
        country,
        role, // Now correctly passed
      },
    });

    const token = generateJwt(newUser);
    const userResponse = {
      id: newUser.id,
      firstname: newUser.firstname,
      lastname: newUser.lastname,
      email: newUser.email,
      country: newUser.country,
      role: newUser.role,
    };

    return res.status(201).json(new ApiResponse(201, { user: userResponse, token }, "User registered successfully"));
  } catch (error) {
    console.error("Error registering user:", error.message, error.stack); // Enhanced logging
    return next(new ApiError(500, "Failed to register user", error.message));
  }
};
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ApiError(400, "Email and password are required"));
    }

    const user = await prisma.user.findUnique({ where: { email } });
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
    };

    return res.status(200).json(new ApiResponse(200, { user: userResponse, token }, "Login successful"));
  } catch (error) {
    console.error("Error logging in user:", error);
    return next(new ApiError(500, "Failed to login user", error.message));
  }
};

const updateUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userId = req.user.id;
    const { firstname, lastname, email, country, password, username, profilePicture, bio } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or account is deactivated"));
    }

    const updateData = {};
    if (firstname) updateData.firstname = firstname;
    if (lastname) updateData.lastname = lastname;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new ApiError(400, "Invalid email format"));
      }
      if (email !== user.email && await prisma.user.findUnique({ where: { email } })) {
        return next(new ApiError(400, "Email is already in use"));
      }
      updateData.email = email;
    }
    if (country) updateData.country = country;
    if (password) updateData.password = await hashPassword(password);
    if (username) {
      if (username !== user.username && await prisma.user.findUnique({ where: { username } })) {
        return next(new ApiError(400, "Username is already in use"));
      }
      updateData.username = username;
    }
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture; // From upload middleware if integrated
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      return next(new ApiError(400, "No valid fields provided for update"));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(new ApiResponse(200, updatedUser, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error);
    return next(new ApiError(500, "Failed to update user", error.message));
  }
};

// src/Controllers/user.controller.js (getUserProfile)
// src/Controllers/user.controller.js (getUserProfile)
const getUserProfile = async (req, res, next) => {
  try {
    console.log("getUserProfile: req.user:", req.user); // Debug
    if (!req.user || !req.user.id) {
      console.log("getUserProfile: No user ID from token");
      return next(new ApiError(401, "Unauthorized: No user ID provided"));
    }

    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    console.log("getUserProfile: Queried user:", user); // Debug

    if (!user || !user.isActive) {
      return next(new ApiError(404, "User not found or account is deactivated"));
    }

    const userResponse = {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      country: user.country,
      role: user.role,
    };

    return res.status(200).json(new ApiResponse(200, userResponse, "User profile fetched successfully"));
  } catch (error) {
    console.error("Error fetching user profile:", error.message, error.stack);
    return next(new ApiError(500, "Failed to fetch user profile", error.message));
  }
};

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

    // Soft delete: Set isActive to false
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Optionally: Clear sensitive data or log deletion for audit
    console.log(`User ${userId} deactivated at ${new Date().toISOString()}`);

    return res.status(200).json(new ApiResponse(200, null, "User account deactivated successfully"));
  } catch (error) {
    console.error("Error deleting user:", error);
    return next(new ApiError(500, "Failed to delete user", error.message));
  }
};

// Bonus: Get public user profile (e.g., for freelancer visibility)
// const getPublicUserProfile = async (req, res, next) => {
//   try {
//     const { userId } = req.params;

//     const user = await prisma.user.findUnique({
//       where: { id: parseInt(userId) },
//       select: {
//         id: true,
//         firstname: true,
//         lastname: true,
//         username: true,
//         role: true,
//         profilePicture: true,
//         bio: true,
//         createdAt: true,
//         freelancerProfile: {
//           select: {
//             jobTitle: true,
//             overview: true,
//             skills: true,
//             rating: true,
//             totalEarnings: true,
//             availabilityStatus: true,
//           },
//         },
//       },
//     });

//     if (!user || !user.isActive) {
//       return next(new ApiError(404, "User not found or account is deactivated"));
//     }

//     return res.status(200).json(new ApiResponse(200, user, "Public user profile retrieved successfully"));
//   } catch (error) {
//     console.error("Error retrieving public user profile:", error);
//     return next(new ApiError(500, "Failed to retrieve public user profile", error.message));
//   }
// };

export { registerUser, loginUser, updateUser, getUserProfile, deleteUser };