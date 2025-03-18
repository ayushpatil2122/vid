// src/Middlewares/protect.middleware.js (or authMiddleware.js)
import jwt from "jsonwebtoken";
import { ApiError } from "../Utils/ApiError.js";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("authenticateToken: authHeader:", authHeader); // Debug header

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("authenticateToken: Invalid or missing Authorization header");
    return next(new ApiError(401, "Access denied. Invalid or missing Authorization header."));
  }

  const token = authHeader.split(" ")[1];
  console.log("authenticateToken: token:", token); // Debug extracted token

  if (!token) {
    console.log("authenticateToken: No token provided after Bearer");
    return next(new ApiError(401, "Access denied. No token provided."));
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("authenticateToken: Decoded token:", decoded); // Debug decoded payload
    req.user = decoded; // { id, email, role } from generateJwt
    next();
  } catch (error) {
    console.error("authenticateToken: Verification error:", error.message, error.stack);
    return next(new ApiError(403, "Invalid or expired token"));
  }
};

export { authenticateToken };