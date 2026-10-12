"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { campaignIsReadOnly } from "@/brand/planning";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function selectCampaignCreatorAction(formData: FormData) {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const rateId = String(formData.get("rate_id") ?? "");
  const quantityText = String(formData.get("quantity") ?? "");
  const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : -1;
  const priceText = String(formData.get("expected_rate_cents") ?? "");
  const expectedRate = /^\d+$/.test(priceText) ? Number(priceText) : null;
  const url = `/brand/discover?campaign=${encodeURIComponent(campaignId)}`;
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100 || (quantity > 0 && (expectedRate === null || !Number.isSafeInteger(expectedRate)))) redirect(`${url}&error=quantity`);
  const { data: campaign } = await supabase.from("brand_campaigns").select("id,status").eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home?error=campaign");
  if (campaignIsReadOnly(campaign.status)) redirect(`${url}&error=read_only`);
  const { error } = await supabase.rpc("set_brand_creator_selection", {
    target_campaign_id: campaign.id, target_rate_id: rateId, target_quantity: quantity, expected_rate_cents: expectedRate,
  });
  if (error) {
    const code = ["brief_not_approved", "rate_unavailable", "creator_unavailable", "campaign_read_only", "deliverable_mismatch", "rate_changed", "selection_limit"].find((name) => error.message.includes(name)) ?? "save";
    redirect(`${url}&error=${code}`);
  }
  for (const path of ["/brand/discover", "/brand/plan", "/brand/create"]) revalidatePath(path);
  redirect(`${url}&saved=1`);
}
