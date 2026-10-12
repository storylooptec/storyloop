"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { isIsoDate, isUuid } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function transitionCampaignAction(formData: FormData) {
  const context = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const date = String(formData.get("event_date") ?? "");
  if (!isUuid(campaignId)) redirect("/brand/home");
  const destination = `/brand/campaigns/${campaignId}/manage`;
  if (!["active", "completed"].includes(status) || !isIsoDate(date) || date > new Date().toISOString().slice(0, 10) || formData.get("confirmed") !== "on") redirect(`${destination}?error=validation`);
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns").select("id").eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home");
  const { error } = await supabase.rpc("transition_brand_campaign", { target_campaign_id: campaignId, target_status: status, event_at: `${date}T00:00:00.000Z` });
  if (error) redirect(`${destination}?error=readiness`);
  revalidatePath("/brand/home");
  revalidatePath("/brand/reports");
  revalidatePath(destination);
  redirect(`${destination}?saved=1`);
}
