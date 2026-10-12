"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/audit/log-event";
import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { isIsoDate, isUuid, metricKeys, metricPlatforms, parseMetricValue } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveCampaignMetricsAction(formData: FormData) {
  const context = await requirePermission(permissions.operationsWork);
  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!isUuid(campaignId)) redirect("/admin/settings/campaign-metrics?error=validation");
  const destination = `/admin/settings/campaign-metrics?campaign=${campaignId}`;
  const platform = metricPlatforms.find((item) => item === String(formData.get("platform") ?? ""));
  const metricDate = String(formData.get("metric_date") ?? "");
  const postId = String(formData.get("external_post_id") ?? "").trim();
  const reference = String(formData.get("source_reference") ?? "").trim();
  if (!platform || !isIsoDate(metricDate) || metricDate > new Date().toISOString().slice(0, 10) || postId.length < 1 || postId.length > 240 || reference.length < 3 || reference.length > 1000 || formData.get("daily_confirmed") !== "on") redirect(`${destination}&error=validation`);
  let values: Record<typeof metricKeys[number], number | null>;
  try {
    values = Object.fromEntries(metricKeys.map((key) => [key, parseMetricValue(formData.get(key), key.endsWith("cents"))])) as typeof values;
    if (Object.values(values).every((value) => value === null)) throw new Error("No measurements");
  } catch { redirect(`${destination}&error=validation`); }
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns").select("id,company_id,status,actual_live_at")
    .eq("id", campaignId).in("status", ["active", "completed"]).maybeSingle();
  if (!campaign?.actual_live_at || metricDate < campaign.actual_live_at.slice(0, 10)) redirect(`${destination}&error=date`);
  const { data: previous } = await supabase.from("brand_campaign_metrics").select("*").eq("campaign_id", campaignId).eq("platform", platform).eq("external_post_id", postId).eq("metric_date", metricDate).maybeSingle();
  const record = { company_id: campaign.company_id, campaign_id: campaignId, metric_date: metricDate, platform, external_post_id: postId, source_type: "manual_export", source_reference: reference, ...values, currency: "INR", recorded_by: context.userId, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("brand_campaign_metrics").upsert(record, { onConflict: "campaign_id,platform,external_post_id,metric_date" }).select("id").single();
  if (error) redirect(`${destination}&error=save`);
  await logAuditEvent({ companyId: context.companyId, actorUserId: context.userId, action: "campaign.measurement_saved", entityType: "brand_campaign_metric", entityId: data.id, beforeState: previous, afterState: record });
  revalidatePath("/brand/reports");
  revalidatePath("/admin/settings/campaign-metrics");
  redirect(`${destination}&saved=1`);
}
