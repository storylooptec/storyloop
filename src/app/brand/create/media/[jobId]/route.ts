import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getR2Client } from "@/lib/r2/client";
import { previewBucket } from "@/brand/creative-assets";
import { isUuid } from "@/brand/creative";

export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUuid(jobId)) return new Response("Not found", { status: 404 });
  const db = await createServerSupabaseClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { data: job } = await db.from("brand_preview_jobs").select("*").eq("id", jobId).eq("status", "completed").maybeSingle();
  if (!job?.media_object_key?.startsWith(`private/brand-previews/${job.company_id}/`)) return new Response("Not found", { status: 404 });
  const { data: consent } = await db.from("brand_preview_requests").select("status,expires_at,creative_id,creative_revision").eq("id", job.request_id).maybeSingle();
  if (consent?.status !== "approved" || Date.parse(consent.expires_at) <= Date.now()) return new Response("Preview permission has expired or been revoked", { status: 403 });
  const service = createServiceSupabaseClient();
  const { data: creative } = await service.from("brand_campaign_creatives").select("revision,approval_state,plan_revision").eq("id", consent.creative_id).maybeSingle();
  const { data: plan } = await service.from("brand_campaign_plans").select("revision,approval_state").eq("campaign_id", job.campaign_id).maybeSingle();
  if (creative?.approval_state !== "approved" || creative.revision !== consent.creative_revision || plan?.approval_state !== "approved" || creative.plan_revision !== plan.revision) return new Response("Preview approval is no longer current", { status: 403 });
  const range = request.headers.get("range");
  if (range && !/^bytes=\d+-\d*$/.test(range)) return new Response("Unsupported range", { status: 416 });
  try {
    const output = await getR2Client().send(new GetObjectCommand({ Bucket: previewBucket(), Key: job.media_object_key, ...(range ? { Range: range } : {}) }));
    if (!output.Body) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "Content-Type": job.media_content_type || "application/octet-stream",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline", "Accept-Ranges": "bytes" });
    if (output.ContentLength !== undefined) headers.set("Content-Length", String(output.ContentLength));
    if (output.ContentRange) headers.set("Content-Range", output.ContentRange);
    return new Response(output.Body.transformToWebStream(), { status: range ? 206 : 200, headers });
  } catch { return new Response("Preview unavailable", { status: range ? 416 : 404 }); }
}
