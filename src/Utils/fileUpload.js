import AWS from "aws-sdk";
import { ApiError } from "./ApiError.js";

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Upload file to S3
export const uploadFileToS3 = async (file, key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read", // Adjust based on your access needs
    };

    const { Location } = await s3.upload(params).promise();
    return Location; // Returns the S3 URL
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw new ApiError(500, "Failed to upload file to S3", error.message);
  }
};

// Delete file from S3
export const deleteFileFromS3 = async (key) => {
  try {
    // Extract key from URL (e.g., https://bucket.s3.region.amazonaws.com/key)
    const urlParts = key.split("/");
    const s3Key = urlParts.slice(3).join("/");

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    };

    await s3.deleteObject(params).promise();
    console.log(`File deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw new ApiError(500, "Failed to delete file from S3", error.message);
  }
};
