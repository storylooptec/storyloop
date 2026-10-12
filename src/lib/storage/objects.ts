import "server-only";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { BRAND_ASSETS_BUCKET, PRIVATE_MEDIA_BUCKET, storageConfigured } from "./config";

type Bucket = typeof BRAND_ASSETS_BUCKET | typeof PRIVATE_MEDIA_BUCKET;

export class AssetStorageError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

function storage(bucket: Bucket, key: string) {
  if (![BRAND_ASSETS_BUCKET, PRIVATE_MEDIA_BUCKET].includes(bucket)
    || !key || !/^[a-zA-Z0-9_./-]+$/.test(key)
    || key.split("/").some(part => !part || part === "." || part === "..")) {
    throw new AssetStorageError("asset_key_invalid", 400);
  }
  if (!storageConfigured()) throw new AssetStorageError("storage_not_configured", 503);
  return createServiceSupabaseClient().storage.from(bucket);
}

function failure(error: unknown): AssetStorageError {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "NoSuchKey" || code === "NoSuchObject") return new AssetStorageError("asset_not_found", 404);
  if (code === "NoSuchBucket") return new AssetStorageError("storage_bucket_missing", 503);
  return new AssetStorageError("storage_request_failed", 502);
}

/** Server-only. Callers must authorize the actor and resource before invoking these helpers. */
export async function uploadStorageObject(bucket: Bucket, key: string, body: Uint8Array, contentType: string, upsert = false) {
  const { error } = await storage(bucket, key).upload(key, body, { contentType, cacheControl: "0", upsert });
  if (error) throw failure(error);
}

export async function deleteStorageObject(bucket: Bucket, key: string) {
  const { error } = await storage(bucket, key).remove([key]);
  if (error) throw failure(error);
}

export async function signedStorageUrl(bucket: Bucket, key: string, expiresIn: number) {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) throw new AssetStorageError("asset_expiry_invalid", 400);
  const { data, error } = await storage(bucket, key).createSignedUrl(key, expiresIn);
  if (error || !data?.signedUrl) throw failure(error);
  return data.signedUrl;
}

/** Keep the signed URL on the server; stream bytes through the consent/tenant guarded route. */
export async function downloadStorageObject(bucket: Bucket, key: string, range?: string | null) {
  if (range && !/^bytes=\d+-\d*$/.test(range)) throw new AssetStorageError("asset_range_invalid", 416);
  const url = await signedStorageUrl(bucket, key, 60);
  const response = await fetch(url, {
    headers: range ? { Range: range } : undefined,
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(45000),
  });
  if (response.status === 416) throw new AssetStorageError("asset_range_invalid", 416);
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new AssetStorageError(response.status === 404 ? "asset_not_found" : "storage_request_failed", response.status === 404 ? 404 : 502);
  }
  return response;
}

export function assetFailureResponse(error: unknown): Response {
  const failure = error instanceof AssetStorageError ? error : new AssetStorageError("storage_request_failed", 502);
  // Never send provider error messages, signed URLs or credentials to the client or logs.
  return new Response("Asset unavailable", { status: failure.status, headers: {
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "X-Storyloop-Asset-Storage": "supabase", "X-Storyloop-Asset-Error": failure.code,
  } });
}
