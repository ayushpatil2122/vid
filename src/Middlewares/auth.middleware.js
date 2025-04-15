import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {ApiResponse} from "../Utils/ApiResponse.js";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// Protect middleware: Verifies JWT and attaches user to req.user
export const protect = async (req, res, next) => {
  const requestId = uuidv4();
  console.log(`[${requestId}] protect middleware: Checking authentication`);

  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    console.log(`[${requestId}] Token found`);
  } else {
    console.warn(`[${requestId}] No token provided`);
    return res.status(401).json(
      new ApiResponse(401, null, "Not authorized: No token provided")
    );
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[${requestId}] Token verified, userId: ${decoded.id}`);

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true, // Assuming role is stored in User model
      },
    });

    if (!user) {
      console.warn(`[${requestId}] User not found for id: ${decoded.id}`);
      return res.status(401).json(
        new ApiResponse(401, null, "Not authorized: User not found")
      );
    }

    // Attach user to request
    req.user = user;
    console.log(`[${requestId}] User attached to req.user: ${user.id}`);
    next();
  } catch (error) {
    console.error(`[${requestId}] Error in protect middleware:`, {
      message: error.message,
      stack: error.stack,
      token,
    });

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json(
        new ApiResponse(401, null, "Not authorized: Invalid token")
      );
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json(
        new ApiResponse(401, null, "Not authorized: Token expired")
      );
    }

    return res.status(500).json(
      new ApiResponse(500, null, "Internal server error")
    );
  }
};

// RestrictTo middleware: Ensures user has one of the specified roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    const requestId = uuidv4();
    console.log(`[${requestId}] restrictTo middleware: Checking roles ${roles}`);

    if (!req.user) {
      console.warn(`[${requestId}] No user attached to request`);
      return res.status(401).json(
        new ApiResponse(401, null, "Not authorized: No user")
      );
    }

    if (!roles.includes(req.user.role)) {
      console.warn(
        `[${requestId}] User role ${req.user.role} not allowed. Required: ${roles}`
      );
      return res.status(403).json(
        new ApiResponse(
          403,
          null,
          `Forbidden: Requires one of roles ${roles.join(", ")}`
        )
      );
    }

    console.log(`[${requestId}] Role ${req.user.role} authorized`);
    next();
  };
};

// Optional: Cleanup Prisma client on process exit
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Prisma client disconnected on SIGINT");
  process.exit(0);
});