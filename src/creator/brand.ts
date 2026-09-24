import { getR2Config } from "@/lib/r2/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function publicUrlFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>).publicUrl;
  return typeof value === "string" && value ? value : null;
}

export async function getCreatorBrandLogoUrl() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("company_brand_settings")
    .select("primary_logo_key,primary_logo_meta,light_logo_key,light_logo_meta,dark_logo_key,dark_logo_meta")
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const configured =
    publicUrlFromMeta(data.dark_logo_meta) ??
    publicUrlFromMeta(data.primary_logo_meta) ??
    publicUrlFromMeta(data.light_logo_meta);

  if (configured) return configured;

  const objectKey = data.dark_logo_key ?? data.primary_logo_key ?? data.light_logo_key;
  if (!objectKey) return null;

  try {
    const base = getR2Config().publicBaseUrl;
    return base ? `${base.replace(/\/$/, "")}/${objectKey}` : null;
  } catch {
    return null;
  }
}
