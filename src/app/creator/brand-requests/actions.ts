"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreatorContext } from "@/creator/context";
import { MUTABLE_CAMPAIGN_STATES, previewRequestHash } from "@/brand/creative";
import { deletePreviewAsset, uploadCreatorPreviewReference } from "@/brand/creative-assets";
import { trackInfrastructureOperation } from "@/lib/providers/infrastructure";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function respondToBrandPreviewAction(formData: FormData) {
  const context = await requireCreatorContext();
  if (context.demoMode) redirect("/creator/brand-requests?error=demo");
  const service = createServiceSupabaseClient();
  const requestId = String(formData.get("request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["approve", "reject", "revoke"].includes(decision)) redirect("/creator/brand-requests?error=invalid");
  const { data: request } = await service.from("brand_preview_requests").select("*").eq("id", requestId).eq("creator_id", context.account.creator_id).maybeSingle();
  if (!request || request.request_hash !== formData.get("request_hash")) redirect("/creator/brand-requests?error=stale");
  const allowed = decision === "revoke" ? request.status === "approved" : request.status === "awaiting_consent";
  if (!allowed) redirect("/creator/brand-requests?error=stale");
  if (decision !== "approve") {
    const { error } = await service.from("brand_preview_requests").update({ status: decision === "revoke" ? "revoked" : "rejected", updated_at: new Date().toISOString() }).eq("id", request.id).eq("status", request.status).eq("creator_id", context.account.creator_id);
    if (error) redirect("/creator/brand-requests?error=save");
    // Access is revoked in DB first. Object cleanup is best effort and never restores access.
    if (request.reference_object_key) await trackInfrastructureOperation({ provider: "r2", operation: "delete_revoked_creator_reference", companyId: request.company_id, campaignId: request.campaign_id, userId: context.userId, inputUnits: 1, unitType: "object" }, () => deletePreviewAsset(request.reference_object_key!)).catch(() => undefined);
    revalidatePath("/brand/create"); revalidatePath("/creator/brand-requests");
    redirect("/creator/brand-requests?saved=1");
  }
  if (formData.get("consent") !== "yes" || Date.parse(request.expires_at) <= Date.now()) redirect("/creator/brand-requests?error=consent");
  const { data: creative } = await service.from("brand_campaign_creatives").select("revision,approval_state,plan_revision").eq("id", request.creative_id).maybeSingle();
  const { data: plan } = await service.from("brand_campaign_plans").select("revision,approval_state").eq("campaign_id", request.campaign_id).maybeSingle();
  const { data: campaign } = await service.from("brand_campaigns").select("status").eq("id", request.campaign_id).maybeSingle();
  if (!creative || creative.approval_state !== "approved" || creative.revision !== request.creative_revision || plan?.approval_state !== "approved" || plan.revision !== creative.plan_revision || !campaign || !MUTABLE_CAMPAIGN_STATES.has(campaign.status)) redirect("/creator/brand-requests?error=stale");
  const file = formData.get("reference_photo");
  if (!(file instanceof File)) redirect("/creator/brand-requests?error=photo");
  let asset: { key: string; sha256: string } | undefined;
  try {
    asset = await trackInfrastructureOperation({ provider: "r2", operation: "upload_creator_preview_reference", companyId: request.company_id, campaignId: request.campaign_id, userId: context.userId, inputUnits: file.size, unitType: "byte" }, async () => {
      asset = await uploadCreatorPreviewReference(context.account.creator_id, file);
      return asset;
    });
    const hash = previewRequestHash({ campaignId: request.campaign_id, creativeId: request.creative_id, revision: request.creative_revision, kind: "image", creatorId: context.account.creator_id, prompt: request.prompt, referenceHash: asset.sha256 });
    const { data, error } = await service.from("brand_preview_requests").update({ status: "approved", reference_object_key: asset.key,
      reference_sha256: asset.sha256, request_hash: hash, consented_at: new Date().toISOString(), consented_by: context.userId,
      consent_version: "creator-campaign-image-preview-v1", updated_at: new Date().toISOString() }).eq("id", request.id).eq("status", "awaiting_consent").eq("request_hash", request.request_hash).eq("creator_id", context.account.creator_id).select("id").maybeSingle();
    if (error || !data) throw new Error("consent_save_failed");
  } catch {
    if (asset) await trackInfrastructureOperation({ provider: "r2", operation: "cleanup_creator_preview_reference", companyId: request.company_id, campaignId: request.campaign_id, userId: context.userId, inputUnits: 1, unitType: "object" }, () => deletePreviewAsset(asset!.key)).catch(() => undefined);
    redirect("/creator/brand-requests?error=photo");
  }
  revalidatePath("/brand/create"); revalidatePath("/creator/brand-requests");
  redirect("/creator/brand-requests?saved=1");
}
