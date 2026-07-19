import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config/env";
import fs from "fs";

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local file to Cloudinary and returns the secure URL.
 * Automatically deletes the local file after a successful upload.
 */
export const uploadImageToCloudinary = async (
  localFilePath: string,
  folder: string = "za2zoo2a",
): Promise<string> => {
  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(
      localFilePath,
      {
        folder,
        resource_type: "image",
      },
    );

    // Remove file from local uploads directory
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return result.secure_url;
  } catch (error) {
    // Attempt to clean up even on failure
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw error;
  }
};
