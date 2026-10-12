import { BRAND_ASSETS_BUCKET } from "@/lib/storage/config";
import { downloadStorageObject, assetFailureResponse } from "@/lib/storage/objects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") ?? "primary";
  const supabase = await createServerSupabaseClient();

  const isPublicStoryloopLogo = url.searchParams.get("public") === "1";
  const { data } = isPublicStoryloopLogo
    ? await supabase
        .from("storyloop_public_brand_assets")
        .select("primary_logo_key,dark_logo_key,light_logo_key")
        .limit(1)
        .maybeSingle()
    : await supabase
        .from("company_brand_settings")
        .select("primary_logo_key,dark_logo_key,light_logo_key,favicon_key")
        .limit(1)
        .maybeSingle();

  const key =
    slot === "favicon"
      ? data && "favicon_key" in data ? data.favicon_key as string | null : null
      : slot === "dark"
      ? data?.dark_logo_key ?? data?.primary_logo_key
      : slot === "light"
        ? data?.light_logo_key ?? data?.primary_logo_key
        : data?.primary_logo_key ?? data?.light_logo_key ?? data?.dark_logo_key;

  if (!key) return new Response("Logo not configured", { status: 404 });

  try {
    const result = await downloadStorageObject(BRAND_ASSETS_BUCKET, key);
    return new Response(result.body, {
      headers: {
        "Content-Type": result.headers.get("content-type") ?? "image/webp",
        "Cache-Control": isPublicStoryloopLogo ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Storyloop-Asset-Storage": "supabase",
      },
    });
  } catch (error) {
    return assetFailureResponse(error);
  }
}
