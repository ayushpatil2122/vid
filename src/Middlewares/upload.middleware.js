// src/middlewares/upload.middleware.js
import { ApiError } from "../Utils/ApiError.js";
import multer from "multer";
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import path from "path";

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer-S3 storage configuration
const s3Storage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET,
  acl: "public-read", // Publicly readable files
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileExtension = path.extname(file.originalname);
    cb(null, `${req.user.id}/${file.fieldname}-${uniqueSuffix}${fileExtension}`);
  },
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["video/mp4", "video/mpeg", "image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ApiError(400, `Invalid file type. Allowed: ${allowedTypes.join(", ")}`), false);
  }
  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Max 10 files per request
  },
});

/**
 * Middleware for uploading a single file
 * @param {string} fieldName - Name of the file field in the request
 * @returns {Function} Middleware function
 */
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, `File upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      if (!req.file) {
        return next(new ApiError(400, "No file uploaded"));
      }
      req.fileUrl = req.file.location; // S3 URL stored here
      next();
    });
  };
};

/**
 * Middleware for uploading multiple files
 * @param {string} fieldName - Name of the file field in the request
 * @param {number} maxCount - Maximum number of files allowed
 * @returns {Function} Middleware function
 */
const uploadMultiple = (fieldName, maxCount) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, `File upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      if (!req.files || req.files.length === 0) {
        return next(new ApiError(400, "No files uploaded"));
      }
      req.fileUrls = req.files.map(file => file.location); // Array of S3 URLs
      next();
    });
  };
};

export { uploadSingle, uploadMultiple };