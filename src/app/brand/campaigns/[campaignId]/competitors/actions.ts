"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { contentHash, domainOf, objectValue, textValue } from "@/brand/competition";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { researchDb, researchConfigurationError } from "@/lib/research/db";
import { recoverSavedResearch } from "@/lib/research/worker";
import type { ResearchScan } from "@/lib/research/types";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function campaignContext(form: FormData) {
  const context = await requireBrandContext();
  const campaignId = String(form.get("campaign_id") ?? "");
  if (!idPattern.test(campaignId)) redirect("/brand/home?error=campaign");
  const auth = await createServerSupabaseClient();
  const { data: campaign } = await auth.from("brand_campaigns")
    .select("id,company_id,brand_name,website_url,promoted_item,status")
    .eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home?error=campaign");
  if (["active", "completed", "archived"].includes(campaign.status)) finish(campaign.id, "error=campaign_read_only");
  return { context, campaign };
}
function finish(campaignId: string, state: string): never {
  revalidatePath(`/brand/campaigns/${campaignId}/competitors`);
  revalidatePath("/brand/competitors");
  revalidatePath("/brand/plan");
  redirect(`/brand/campaigns/${campaignId}/competitors?${state}`);
}
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : textValue(objectValue(error).message);
  if (message === "trusted_database_not_configured") return "research_not_configured";
  return ["scan_daily_limit", "campaign_read_only", "selection_invalid", "scan_running", "provider_disabled", "provider_not_configured", "cost_estimate_required", "worker_not_ready"].find(code => message.includes(code)) ?? "research_unavailable";
}

/** Enqueues durable work only. Repeated submits join the same job or reuse its saved result. */
export async function runCompetitorScanAction(form: FormData) {
  const { context, campaign } = await campaignContext(form);
  let state = "";
  try {
    const db = researchDb();
    const ownDomain = campaign.website_url ? domainOf(campaign.website_url) : null;
    const brand = textValue(campaign.brand_name, 100);
    const product = textValue(campaign.promoted_item, 220);
    const queryHash = contentHash(JSON.stringify(["openai-discovery-on-demand-v2", brand.toLowerCase(), product.toLowerCase(), ownDomain, "IN", "en"]));
    // Cached research remains usable when providers are paused or credentials change.
    const { data: existing, error: readError } = await db.from("brand_competitor_scans")
      .select("*").eq("company_id", context.companyId).eq("campaign_id", campaign.id)
      .eq("query_hash", queryHash).in("status", ["queued", "running", "succeeded"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (readError) throw new Error("research_unavailable");
    if (existing && (["queued", "running"].includes(existing.status) || existing.cache_expires_at && Date.parse(existing.cache_expires_at) > Date.now())) {
      if (existing.status === "succeeded") await recoverSavedResearch(existing as ResearchScan);
      state = `scan=${existing.id}&${existing.status === "succeeded" ? "cached" : "queued"}=1`;
    } else {
      const configurationError = researchConfigurationError("discovery");
      if (configurationError) throw new Error(configurationError);
      const { data, error } = await db.rpc("enqueue_research_scan", {
        target_company_id: context.companyId, target_campaign_id: campaign.id, actor_id: context.userId,
        query_hash: queryHash, payload: { flow: "on_demand_v2", brand, product, ownDomain, market: "IN", language: "en" },
      });
      if (error) throw new Error(error.message);
      const result = objectValue(data);
      if (typeof result.scan_id !== "string") throw new Error("research_unavailable");
      state = `scan=${result.scan_id}&${result.disposition === "cached" ? "cached" : "queued"}=1`;
    }
  } catch (error) {
    const code = safeError(error);
    console.error("[brand-research] Enqueue failed", { campaignId: campaign.id, code });
    state = `error=${encodeURIComponent(code)}`;
  }
  finish(campaign.id, state);
}

/** Explicit zero-provider-cost repair; authentication and tenant checks apply. */
export async function recoverCompetitorResultsAction(form: FormData) {
  const { context, campaign } = await campaignContext(form);
  const scanId = String(form.get("scan_id") ?? "");
  if (!idPattern.test(scanId)) finish(campaign.id, "error=selection_invalid");
  let failure = false;
  try {
    const { data: scan, error } = await researchDb().from("brand_competitor_scans").select("*")
      .eq("id", scanId).eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle();
    if (error || !scan || !["succeeded", "failed"].includes(scan.status)) throw new Error("scan_running");
    await recoverSavedResearch(scan as ResearchScan);
  } catch { failure = true; }
  finish(campaign.id, `scan=${scanId}&${failure ? "error=research_unavailable" : "rechecked=1"}`);
}

export async function saveCompetitorSelectionAction(form: FormData) {
  const { context, campaign } = await campaignContext(form);
  const scanId = String(form.get("scan_id") ?? "");
  const selected = [...new Set(form.getAll("competitor_ids").map(String))];
  if (!idPattern.test(scanId) || !selected.length || selected.length > 5 || selected.some(id => !idPattern.test(id))) finish(campaign.id, "error=selection_invalid");
  let failure: string | null = null;
  try {
    const { error } = await researchDb().rpc("select_research_competitors", {
      target_company_id: context.companyId, target_campaign_id: campaign.id, actor_id: context.userId,
      target_scan_id: scanId, selected_ids: selected,
    });
    if (error) throw new Error(error.message);
  } catch (error) { failure = safeError(error); }
  if (failure) finish(campaign.id, `scan=${scanId}&error=${failure}`);
  revalidatePath(`/brand/campaigns/${campaign.id}/competitors`);
  revalidatePath("/brand/plan");
  redirect(`/brand/plan?campaign=${campaign.id}`);
}


/** The only entry point that authorizes SearchAPI details for a single competitor. */
export async function getCompetitorDetailsAction(form: FormData): Promise<{ error?: string }> {
  const { context, campaign } = await campaignContext(form);
  const scanId = String(form.get("scan_id") ?? "");
  const competitorId = String(form.get("competitor_id") ?? "");
  if (!idPattern.test(scanId) || !idPattern.test(competitorId)) return { error: "Invalid competitor selection." };
  try {
    const config = researchConfigurationError("details");
    if (config) return { error: "SearchAPI is not configured for detail fetching. Your shortlist is saved." };
    const { error } = await researchDb().rpc("enqueue_competitor_details", { target_company_id: context.companyId, target_campaign_id: campaign.id, actor_id: context.userId, target_scan_id: scanId, target_competitor_id: competitorId });
    if (error) return { error: error.message.includes("discovery_expired") ? "This shortlist is over 24 hours old. Refresh competitor scan first." : "Details could not start. Your saved shortlist is unchanged." };
    revalidatePath(`/brand/campaigns/${campaign.id}/competitors`);
    return {};
  } catch { return { error: "Details could not start. Please reload to check saved progress before trying again." }; }
}
