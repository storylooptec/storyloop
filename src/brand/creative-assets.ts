import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2/client";

export function previewBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME?.trim();
  if (!bucket || bucket === process.env.R2_BUCKET_NAME && Boolean(process.env.R2_PUBLIC_BASE_URL)) throw new Error("private_storage_not_configured");
  return bucket;
}

function imageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/webp") return Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString() === "WEBP";
  return false;
}

export async function uploadCreatorPreviewReference(creatorId: string, file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("reference_invalid");
  const body = Buffer.from(await file.arrayBuffer());
  if (!imageSignature(file.type, body)) throw new Error("reference_invalid");
  const key = `private/creator-previews/${creatorId}/${randomUUID()}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: previewBucket(), Key: key, Body: body,
    ContentType: file.type, CacheControl: "private, no-store" }));
  return { key, sha256: createHash("sha256").update(body).digest("hex") };
}

export async function signedReferenceUrl(key: string) {
  if (!key.startsWith("private/creator-previews/")) throw new Error("reference_invalid");
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: previewBucket(), Key: key }), { expiresIn: 3600 });
}

export async function deletePreviewAsset(key: string) {
  if (!key.startsWith("private/")) throw new Error("asset_invalid");
  await getR2Client().send(new DeleteObjectCommand({ Bucket: previewBucket(), Key: key }));
}

function publicAddress(address: string): boolean {
  if (isIP(address) === 6) return !/^(::|fc|fd|fe[89ab]|ff)/i.test(address);
  const [a,b] = address.split(".").map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168)
    && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19));
}

/** Only authenticated provider output on administrator-verified exact CDN hosts is fetched. */
export async function archivePreviewOutput(input: { jobId: string; companyId: string; kind: string; url: string }) {
  const url = new URL(input.url);
  const allowed = (process.env.HIGGSFIELD_MEDIA_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname.toLowerCase()) || isIP(url.hostname)) throw new Error("media_host_not_allowed");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) throw new Error("media_host_not_allowed");
  const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.body) throw new Error("media_download_failed");
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const max = input.kind === "video" ? 64 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!(input.kind === "video" ? ["video/mp4", "video/webm"] : ["image/png", "image/jpeg", "image/webp"]).includes(type)) throw new Error("media_type_invalid");
  if (Number(response.headers.get("content-length")) > max) throw new Error("media_too_large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("media_too_large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  if (!size || (input.kind === "image" && !imageSignature(type, bytes))
    || (type === "video/mp4" && bytes.subarray(4,8).toString() !== "ftyp")
    || (type === "video/webm" && bytes.subarray(0,4).toString("hex") !== "1a45dfa3")) throw new Error("media_signature_invalid");
  const key = `private/brand-previews/${input.companyId}/${input.jobId}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: previewBucket(), Key: key,
    Body: bytes, ContentType: type, CacheControl: "private, no-store" }));
  return { key, contentType: type };
}
