"use server";

import { redirect } from "next/navigation";

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

export async function createCampaignDraftAction(formData: FormData) {
  const context = await requireBrandContext();
  const brandName = String(formData.get("brand_name") ?? "").trim().slice(0, 120);
  const websiteRaw = String(formData.get("website_url") ?? "");
  const promotedItem = String(formData.get("promoted_item") ?? "").trim().slice(0, 240);
  const objective = String(formData.get("objective") ?? "");
  const titleValue = String(formData.get("title") ?? "").trim().slice(0, 120);
  const budgetValue = String(formData.get("budget_inr") ?? "").trim();
  const budgetInr = budgetValue ? Number(budgetValue) : null;
  if (budgetInr !== null && (!Number.isFinite(budgetInr) || budgetInr < 0 || budgetInr > 1000000000)) {
    throw new Error("Enter a valid budget in INR.");
  }
  const deliverables = formData
    .getAll("deliverable")
    .map((value) => String(value))
    .filter((value) => allowedDeliverables.has(value));

  if (!brandName || !promotedItem) throw new Error("Brand name and campaign focus are required.");
  if (!["awareness", "consideration", "sales"].includes(objective)) {
    throw new Error("Choose a campaign objective.");
  }
  if (deliverables.length === 0) throw new Error("Select at least one deliverable.");

  const websiteUrl = normalizeWebsite(websiteRaw);
  const logoFile = formData.get("logo");
  let logoKey: string | null = null;

  if (logoFile instanceof File && logoFile.size > 0) {
    const uploaded = await uploadBrandAsset({
      companyId: context.companyId,
      slot: "primary_logo",
      file: logoFile,
    });
    logoKey = uploaded.objectKey;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
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

  if (error || !data) {
    if (logoKey) {
      try { await deleteBrandAsset(logoKey); } catch { /* Retry cleanup operationally. */ }
    }
    throw new Error("The campaign draft could not be saved. Try again.");
  }

  redirect(`/brand/campaigns/${data.id}/competitors`);
}
