import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { PRIVATE_MEDIA_BUCKET } from "@/lib/storage/config";
import { downloadStorageObject, assetFailureResponse } from "@/lib/storage/objects";
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
    const output = await downloadStorageObject(PRIVATE_MEDIA_BUCKET, job.media_object_key, range);
    const headers = new Headers({ "Content-Type": job.media_content_type || "application/octet-stream",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline", "Accept-Ranges": "bytes" });
    const length = output.headers.get("content-length");
    const contentRange = output.headers.get("content-range");
    if (length !== null) headers.set("Content-Length", length);
    if (contentRange) headers.set("Content-Range", contentRange);
    // Preserve the actual upstream status: a server may ignore Range and return 200.
    return new Response(output.body, { status: output.status, headers });
  } catch (error) { return assetFailureResponse(error); }
}
