import "server-only";

// Both buckets are private. Application routes authorize each read/write.
export const BRAND_ASSETS_BUCKET = "storyloop-brand-assets";
export const PRIVATE_MEDIA_BUCKET = "storyloop-private-media";
export const MAX_PREVIEW_VIDEO_BYTES = 50 * 1024 * 1024;

/** Credential presence only; this does not prove bucket or API health. */
export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim()
    && (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()));
}
