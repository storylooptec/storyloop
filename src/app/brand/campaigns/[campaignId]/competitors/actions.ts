"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBrandContext } from "@/brand/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
};

type SearchPayload = {
  error?: string;
  organic_results?: SearchResult[];
};

function normalizedHash(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

function domainOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function parsedDate(value?: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchSerpApi(query: string, apiKey: string): Promise<{ payload: SearchPayload; retryCount: number }> {
  const endpoint = new URL("https://serpapi.com/search.json");
  endpoint.searchParams.set("engine", "google");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("gl", "in");
  endpoint.searchParams.set("hl", "en");
  endpoint.searchParams.set("num", "10");
  endpoint.searchParams.set("api_key", apiKey);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (response.status >= 500 && attempt < 2) {
        await wait(250 * (2 ** attempt) + Math.floor(Math.random() * 150));
        continue;
      }
      if (response.status === 429) throw new Error("provider_rate_limited");
      if (!response.ok) throw new Error("provider_request_failed");

      const payload = await response.json() as SearchPayload;
      if (payload.error) throw new Error("provider_request_failed");
      return { payload, retryCount: attempt };
    } catch (error) {
      if (error instanceof Error && error.message === "provider_rate_limited") throw error;
      if (error instanceof Error && error.message === "provider_request_failed") throw error;
      if (attempt === 2) throw new Error("provider_unavailable");
      await wait(250 * (2 ** attempt) + Math.floor(Math.random() * 150));
    }
  }

  throw new Error("provider_unavailable");
}

async function recordUsage(input: {
  companyId: string;
  campaignId: string;
  actorUserId: string;
  status: "success" | "failed" | "rate_limited" | "cached";
  latencyMs?: number;
  cacheHit?: boolean;
  failureCode?: string;
  retryCount?: number;
}) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("external_api_usage_events").insert({
    company_id: input.companyId,
    campaign_id: input.campaignId,
    actor_user_id: input.actorUserId,
    provider_key: "serpapi",
    operation: "competitor_discovery",
    status: input.status,
    latency_ms: input.latencyMs ?? null,
    retry_count: input.retryCount ?? 0,
    cache_hit: input.cacheHit ?? false,
    input_units: input.status === "cached" ? 0 : 1,
    unit_type: "search",
    estimated_cost_usd: input.status === "cached" ? 0 : (process.env.SERP_API_COST_PER_SEARCH_USD && Number.isFinite(Number(process.env.SERP_API_COST_PER_SEARCH_USD)) ? Number(process.env.SERP_API_COST_PER_SEARCH_USD) : null),
    failure_code: input.failureCode ?? null,
  });
}

export async function runCompetitorScanAction(formData: FormData) {
  const context = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) redirect("/brand/home?error=campaign");

  const supabase = await createServerSupabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("brand_campaigns")
    .select("id,brand_name,website_url,promoted_item")
    .eq("id", campaignId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (campaignError || !campaign) redirect("/brand/home?error=campaign");

  const query = [campaign.brand_name, campaign.promoted_item, "competitors India"].join(" ");
  const queryHash = normalizedHash(query + "|" + (campaign.website_url ? domainOf(campaign.website_url) ?? "" : "") + "|in|en");
  const cacheCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: cachedScan } = await supabase
    .from("brand_competitor_scans")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("query_hash", queryHash)
    .eq("status", "succeeded")
    .gte("created_at", cacheCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedScan) {
    await recordUsage({
      companyId: context.companyId,
      campaignId: campaign.id,
      actorUserId: context.userId,
      status: "cached",
      cacheHit: true,
    });
    redirect("/brand/campaigns/" + campaign.id + "/competitors?cached=1");
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey || process.env.SERP_API_ENABLED !== "true") {
    redirect("/brand/campaigns/" + campaign.id + "/competitors?error=provider");
  }
  const { data: activeScan } = await supabase
    .from("brand_competitor_scans")
    .select("id")
    .eq("campaign_id", campaign.id)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();

  if (activeScan) redirect("/brand/campaigns/" + campaign.id + "/competitors?error=running");

  const { data: scan, error: insertError } = await supabase
    .from("brand_competitor_scans")
    .insert({
      company_id: context.companyId,
      campaign_id: campaign.id,
      provider_key: "serpapi",
      query_hash: queryHash,
      market: "IN",
      status: "running",
      started_at: new Date().toISOString(),
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (insertError || !scan) {
    redirect("/brand/campaigns/" + campaign.id + "/competitors?error=running");
  }

  const { data: quotaAllowed, error: quotaError } = await supabase
    .rpc("consume_serpapi_scan_quota", { target_company_id: context.companyId });

  if (quotaError || !quotaAllowed) {
    await supabase.from("brand_competitor_scans")
      .update({ status: "failed", error_code: "daily_limit", completed_at: new Date().toISOString() })
      .eq("id", scan.id)
      .eq("company_id", context.companyId);

    await recordUsage({
      companyId: context.companyId,
      campaignId: campaign.id,
      actorUserId: context.userId,
      status: "rate_limited",
      failureCode: quotaError ? "quota_check_unavailable" : "app_daily_limit",
    });
    redirect("/brand/campaigns/" + campaign.id + "/competitors?error=limit");
  }


  const startedAt = Date.now();

  try {
    const { payload, retryCount } = await searchSerpApi(query, apiKey);
    const ownDomain = campaign.website_url ? domainOf(campaign.website_url) : null;
    const seenDomains = new Set<string>();
    const observations = (payload.organic_results ?? [])
      .flatMap((result) => {
        const sourceUrl = result.link ?? "";
        const sourceDomain = domainOf(sourceUrl);
        const sourceTitle = (result.title ?? "").trim().slice(0, 220);
        if (!sourceDomain || !sourceTitle || (ownDomain && (sourceDomain === ownDomain || sourceDomain.endsWith("." + ownDomain)))) return [];
        if (seenDomains.has(sourceDomain)) return [];
        seenDomains.add(sourceDomain);
        const sourceSnippet = (result.snippet ?? "").trim().slice(0, 600);
        return [{
          company_id: context.companyId,
          scan_id: scan.id,
          competitor_name: sourceTitle,
          competitor_domain: sourceDomain,
          source_url: sourceUrl,
          source_domain: sourceDomain,
          source_title: sourceTitle,
          source_snippet: sourceSnippet,
          published_at: parsedDate(result.date),
          content_hash: normalizedHash(sourceUrl + "|" + sourceTitle + "|" + sourceSnippet),
        }];
      })
      .slice(0, 5);

    if (observations.length) {
      const { error: saveError } = await supabase.from("brand_competitor_observations").insert(observations);
      if (saveError) throw new Error("evidence_save_failed");
    }

    const completedAt = new Date().toISOString();
    await supabase.from("brand_competitor_scans")
      .update({ status: "succeeded", result_count: observations.length, completed_at: completedAt })
      .eq("id", scan.id)
      .eq("company_id", context.companyId);
    await supabase.from("brand_campaigns")
      .update({ status: "planning", updated_at: completedAt })
      .eq("id", campaign.id)
      .eq("company_id", context.companyId);

    await recordUsage({
      companyId: context.companyId,
      campaignId: campaign.id,
      actorUserId: context.userId,
      status: "success",
      latencyMs: Date.now() - startedAt,
      retryCount,
    });
  } catch (error) {
    const rateLimited = error instanceof Error && error.message === "provider_rate_limited";
    await supabase.from("brand_competitor_scans")
      .update({
        status: "failed",
        error_code: rateLimited ? "provider_rate_limited" : "scan_failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scan.id)
      .eq("company_id", context.companyId);

    await recordUsage({
      companyId: context.companyId,
      campaignId: campaign.id,
      actorUserId: context.userId,
      status: rateLimited ? "rate_limited" : "failed",
      latencyMs: Date.now() - startedAt,
      failureCode: rateLimited ? "provider_rate_limited" : "scan_failed",
    });
    redirect("/brand/campaigns/" + campaign.id + "/competitors?error=" + (rateLimited ? "limit" : "scan"));
  }

  revalidatePath("/brand/home");
  redirect("/brand/campaigns/" + campaign.id + "/competitors?scanned=1");
}
