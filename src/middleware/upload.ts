import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import { env } from "../config/env";

// Ensure the uploads directory tree exists
const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ── Storage configuration ─────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (
    req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    // Use a subdirectory based on the upload type
    const uploadType =
      (req.params.type as string) ||
      (req.route?.path?.includes("photo") ? "photos" : "documents");
    const dest = path.join(env.UPLOAD_DIR, uploadType);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const userId = (req as unknown as { user?: { userId: string } }).user
      ?.userId;
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `${userId}-${timestamp}${ext}`);
  },
});

// ── File filter ───────────────────────────────────────────────────

const imageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, WebP, HEIC) are allowed"));
  }
};

const documentFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files (JPEG, PNG, WebP, HEIC) and PDFs are allowed",
      ),
    );
  }
};

// ── Export upload instances ────────────────────────────────────────

/** Profile photo upload — single image, max 2 MB */
export const uploadPhoto = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

/** Document upload — single file (image or PDF), max 5 MB */
export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});
