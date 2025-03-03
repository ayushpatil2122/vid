// authMiddleware.js
import jwt from "jsonwebtoken";
import { ApiError } from "../Utils/ApiError.js";

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer TOKEN"

    if (!token) {
        return next(new ApiError(401, 'Access denied. No token provided.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        req.user = decoded; // Attach decoded user data (id, email, role) to request
        next();
    } catch (error) {
        return next(new ApiError(403, 'Invalid or expired token.'));
    }
};

// Optional: Role-based protection
// const restrictTo = (...roles) => {
//     return (req, res, next) => {
//         if (!roles.includes(req.user.role)) {
//             return next(new ApiError(403, 'You do not have permission to perform this action.'));
//         }
//         next();
//     };
// };

export { authenticateToken };