import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import config from "../config";
import logger from "../logger";

// configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

// upload file
export const uploadToCloudinary = async (filePath: string, folder: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto",
    });


    // delete local file after upload
    fs.unlinkSync(filePath);

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
    };
  } catch (error: any) {
    logger.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload file to Cloudinary");
  }
};

// delete file
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    throw new Error("Failed to delete file from Cloudinary");
  }
};
