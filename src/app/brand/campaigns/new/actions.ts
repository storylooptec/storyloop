"use server";

import { redirect } from "next/navigation";
import { trackInfrastructureOperation } from "@/lib/providers/infrastructure";

import { requireBrandContext } from "@/brand/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteBrandAsset, uploadBrandAsset } from "@/lib/r2/brand-assets";

const allowedDeliverables = new Set([
  "instagram_reel",
  "youtube_short",
  "instagram_story",
  "static_post",
]);

function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid website URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Website must use HTTP or HTTPS.");
  }
  return parsed.toString();
}

export async function createCampaignDraftAction(_state: {error:string}|null,formData: FormData):Promise<{error:string}|null> {
  const context = await requireBrandContext();
  const brandName = String(formData.get("brand_name") ?? "").trim().slice(0, 120);
  const websiteRaw = String(formData.get("website_url") ?? "");
  const promotedItem = String(formData.get("promoted_item") ?? "").trim().slice(0, 240);
  const objective = String(formData.get("objective") ?? "");
  const titleValue = String(formData.get("title") ?? "").trim().slice(0, 120);
  const budgetValue = String(formData.get("budget_inr") ?? "").trim();
  const budgetInr = budgetValue ? Number(budgetValue) : null;
  if (budgetInr !== null && (!Number.isFinite(budgetInr) || budgetInr < 0 || budgetInr > 1000000000)) {
    return {error:"Enter a valid budget in INR, up to ₹100 crore."};
  }
  const deliverables = formData
    .getAll("deliverable")
    .map((value) => String(value))
    .filter((value) => allowedDeliverables.has(value));

  if (!brandName || !promotedItem) return {error:"Brand name and campaign focus are required."};
  if (!["awareness", "consideration", "sales"].includes(objective)) {
    return {error:"Choose a campaign objective."};
  }
  if (deliverables.length === 0) return {error:"Select at least one deliverable."};

  let websiteUrl: string|null;
  try { websiteUrl=normalizeWebsite(websiteRaw); } catch { return {error:"Enter a valid website address, or leave it blank."}; }
  const logoFile = formData.get("logo");
  let logoKey: string | null = null;

  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      if (!["image/png","image/jpeg","image/webp"].includes(logoFile.type)) return {error:"Use a PNG, JPG or WebP logo."};
      const uploaded=await trackInfrastructureOperation({provider:"r2",operation:"upload_brand_logo",companyId:context.companyId,userId:context.userId,inputUnits:logoFile.size,unitType:"byte"},()=>uploadBrandAsset({companyId:context.companyId,slot:"primary_logo",file:logoFile}));
      logoKey=uploaded.objectKey;
    } catch { return {error:"The logo could not be uploaded. Check its format and 5 MB size limit, then retry."}; }
  }

  const supabase = await createServerSupabaseClient();
  let createdId:string;
  try {
    const data=await trackInfrastructureOperation({provider:"supabase",operation:"create_brand_campaign",companyId:context.companyId,userId:context.userId},async()=>{
      const result=await supabase
    .from("brand_campaigns")
    .insert({
      company_id: context.companyId,
      created_by: context.userId,
      title: titleValue || `${brandName} campaign`,
      brand_name: brandName,
      website_url: websiteUrl,
      logo_key: logoKey,
      promoted_item: promotedItem,
      objective,
      deliverables,
      requested_budget_cents: budgetInr === null ? null : Math.round(budgetInr * 100),
      status: "draft",
    })
    .select("id")
    .single();
      if(result.error||!result.data)throw new Error("campaign_save_failed");
      return result.data;
    });
    createdId=data.id;
  } catch {
    if(logoKey){try{await trackInfrastructureOperation({provider:"r2",operation:"cleanup_brand_logo",companyId:context.companyId,userId:context.userId},()=>deleteBrandAsset(logoKey!));}catch{/* The failed operation remains recorded for cleanup. */}}
    return {error:"The campaign draft could not be saved. Try again."};
  }

  redirect(`/brand/campaigns/${createdId}/competitors`);
}
