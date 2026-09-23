import { PutObjectCommand } from "@aws-sdk/client-s3";
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

  const safeName = sanitizeBaseName(input.file.name);
  const objectKey = [
    "companies",
    input.companyId,
    "brand",
    input.slot,
    `${Date.now()}-${randomUUID()}-${safeName}.${extension}`,
  ].join("/");

  const body = Buffer.from(await input.file.arrayBuffer());
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
