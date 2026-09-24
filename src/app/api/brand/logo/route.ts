import { GetObjectCommand } from "@aws-sdk/client-s3";

import { getR2Client } from "@/lib/r2/client";
import { getR2Config } from "@/lib/r2/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") ?? "primary";
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("company_brand_settings")
    .select("primary_logo_key,dark_logo_key,light_logo_key")
    .limit(1)
    .maybeSingle();

  const key =
    slot === "dark"
      ? data?.dark_logo_key ?? data?.primary_logo_key
      : slot === "light"
        ? data?.light_logo_key ?? data?.primary_logo_key
        : data?.primary_logo_key ?? data?.light_logo_key ?? data?.dark_logo_key;

  if (!key) return new Response("Logo not configured", { status: 404 });

  try {
    const config = getR2Config();
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );

    if (!result.Body) return new Response("Logo unavailable", { status: 404 });

    const bytes = await result.Body.transformToByteArray();
    const body = Uint8Array.from(bytes).buffer;

    return new Response(body, {
      headers: {
        "Content-Type": result.ContentType ?? "image/webp",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Logo unavailable", { status: 404 });
  }
}
