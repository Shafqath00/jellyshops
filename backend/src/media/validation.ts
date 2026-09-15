import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { ApiError } from "../http/errors.js";

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

export interface ValidatedImage {
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

export async function validateImage(contents: Buffer): Promise<ValidatedImage> {
  const detected = await fileTypeFromBuffer(contents);
  const extension = detected ? allowedTypes.get(detected.mime) : undefined;
  if (!detected || !extension) {
    throw new ApiError(415, "MEDIA_TYPE_UNSUPPORTED", "Upload a PNG, JPEG, WebP, GIF, or AVIF image");
  }

  try {
    const metadata = await sharp(contents, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Image dimensions are missing");
    return { mimeType: detected.mime, extension, width: metadata.width, height: metadata.height };
  } catch {
    throw new ApiError(415, "MEDIA_INVALID", "The uploaded image could not be decoded");
  }
}
