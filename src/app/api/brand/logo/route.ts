import { GetObjectCommand } from "@aws-sdk/client-s3";

import { getR2Client } from "@/lib/r2/client";
import { getR2Config } from "@/lib/r2/config";
import { r2ConfigurationIssues } from "@/lib/r2/config-diagnostics";
import { r2LogoFailureResponse, type R2LogoStage } from "@/lib/r2/logo-error";
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

  let stage: R2LogoStage = "configuration";
  let configIssues: string[] | null = null;
  try {
    const config = getR2Config();
    configIssues = r2ConfigurationIssues(config);
    stage = "client";
    const client = getR2Client();
    stage = "request";
    const result = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );

    stage = "body";
    if (!result.Body) return r2LogoFailureResponse(new Error("Empty R2 response"), stage);

    const bytes = await result.Body.transformToByteArray();
    const body = Uint8Array.from(bytes).buffer;

    stage = "response";
    return new Response(body, {
      headers: {
        "Content-Type": result.ContentType ?? "image/webp",
        "Cache-Control": isPublicStoryloopLogo ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = r2LogoFailureResponse(error, stage);
    response.headers.set("X-Storyloop-R2-Configuration", configIssues === null ? "not_checked" : configIssues.join(",") || "format_checks_passed");
    return response;
  }
}
