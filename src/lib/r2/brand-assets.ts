import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { getR2Client } from "@/lib/r2/client";
import { getR2Config } from "@/lib/r2/config";

export const BRAND_ASSET_SLOTS = [
  "primary_logo",
  "dark_logo",
  "light_logo",
  "favicon",
] as const;

export type BrandAssetSlot = (typeof BRAND_ASSET_SLOTS)[number];

const allowedTypes = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
]);

const maxFileSize = 5 * 1024 * 1024;

export type UploadedBrandAsset = {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  publicUrl: string | null;
};

function sanitizeBaseName(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, "");
  const safe = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return safe.slice(0, 60) || "asset";
}

function hasExpectedSignature(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  if (contentType === "image/x-icon" || contentType === "image/vnd.microsoft.icon") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x00 &&
      bytes[1] === 0x00 &&
      bytes[2] === 0x01 &&
      bytes[3] === 0x00
    );
  }

  return false;
}

export async function uploadBrandAsset(input: {
  companyId: string;
  slot: BrandAssetSlot;
  file: File;
}): Promise<UploadedBrandAsset> {
  const extension = allowedTypes.get(input.file.type);

  if (!extension) {
    throw new Error("Unsupported file type. Use PNG, JPG, WebP or ICO.");
  }

  if (input.file.size <= 0 || input.file.size > maxFileSize) {
    throw new Error("File must be between 1 byte and 5 MB.");
  }

  const body = Buffer.from(await input.file.arrayBuffer());

  if (!hasExpectedSignature(input.file.type, body)) {
    throw new Error("File contents do not match the declared image type.");
  }

  const safeName = sanitizeBaseName(input.file.name);
  const objectKey = [
    "companies",
    input.companyId,
    "brand",
    input.slot,
    `${Date.now()}-${randomUUID()}-${safeName}.${extension}`,
  ].join("/");

  const config = getR2Config();

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: input.file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    objectKey,
    contentType: input.file.type,
    sizeBytes: input.file.size,
    originalFilename: input.file.name,
    publicUrl: config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : null,
  };
}

export async function deleteBrandAsset(objectKey: string): Promise<void> {
  const config = getR2Config();

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );
}
