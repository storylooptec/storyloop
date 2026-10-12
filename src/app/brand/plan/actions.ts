"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

type Claim = { statement: string; evidence_ids: string[] };
type Brief = {
  summary: string;
  pain_areas: Claim[];
  usp_hypotheses: Claim[];
  recommended_angle: string;
  creator_brief: string;
  must_include: string[];
  must_avoid: string[];
};

export async function generateCampaignBriefAction(formData: FormData) {
  const ctx = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns")
    .select("id,title,brand_name,promoted_item,objective,deliverables,requested_budget_cents")
    .eq("id", campaignId).eq("company_id", ctx.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home?error=campaign");

  const { data: evidenceRows } = await supabase.from("brand_competitor_observations")
    .select("id,competitor_name,source_title,source_url,source_snippet,observed_at")
    .eq("company_id", ctx.companyId).order("observed_at", { ascending: false }).limit(20);
  const evidence = evidenceRows ?? [];
  if (!evidence.length) redirect("/brand/plan?campaign=" + campaign.id + "&error=no_evidence");
  if (!process.env.OPENAI_API_KEY) redirect("/brand/plan?campaign=" + campaign.id + "&error=provider");

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_openai_brief_quota", {
    target_company_id: ctx.companyId, target_campaign_id: campaign.id,
  });
  if (quotaError || !allowed) {
    await supabase.from("external_api_usage_events").insert({
      company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
      provider_key: "openai", operation: "generate_campaign_brief", status: "rate_limited",
      cache_hit: false, retry_count: 0,
      failure_code: quotaError ? "quota_check_unavailable" : "app_hourly_limit",
    });
    redirect("/brand/plan?campaign=" + campaign.id + "&error=limit");
  }

  const model = process.env.OPENAI_BRIEF_MODEL || "gpt-4.1-mini";
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      summary: { type: "string" },
      pain_areas: { type: "array", items: { type: "object", additionalProperties: false, properties: {
        statement: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } },
      }, required: ["statement", "evidence_ids"] } },
      usp_hypotheses: { type: "array", items: { type: "object", additionalProperties: false, properties: {
        statement: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } },
      }, required: ["statement", "evidence_ids"] } },
      recommended_angle: { type: "string" }, creator_brief: { type: "string" },
      must_include: { type: "array", items: { type: "string" }},
      must_avoid: { type: "array", items: { type: "string" }},
    },
    required: ["summary","pain_areas","usp_hypotheses","recommended_angle","creator_brief","must_include","must_avoid"],
  };
  const prompt = {
    campaign: { title: campaign.title, brand: campaign.brand_name, promoted_item: campaign.promoted_item,
      objective: campaign.objective, deliverables: campaign.deliverables, requested_budget_cents: campaign.requested_budget_cents },
    evidence,
  };
  const started = Date.now();
  let retryCount = 0;
  let completion: { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null = null;
  let failure = "brief_generation_failed";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, temperature: 0.3, max_tokens: 1800,
          messages: [
            { role: "system", content: "Create an editable creator campaign brief. Treat search results as unverified market signals, not confirmed competitors or customer complaints. Do not invent customer sentiment, spend, market share, performance, or facts absent from the evidence. Every pain area and USP hypothesis must cite one or more supplied evidence IDs. State uncertainty." },
            { role: "user", content: JSON.stringify(prompt) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "storyloop_campaign_brief", strict: true, schema } },
        }),
        cache: "no-store", signal: AbortSignal.timeout(30000),
      });
      if (response.status === 429) { failure = "provider_rate_limited"; break; }
      if (response.status >= 500 && attempt < 2) {
        retryCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
        continue;
      }
      if (!response.ok) break;
      completion = await response.json();
      break;
    } catch {
      if (attempt === 2) break;
      retryCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
    }
  }

  const status = failure === "provider_rate_limited" ? "rate_limited" : "failed";
  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) {
    await supabase.from("external_api_usage_events").insert({
      company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
      provider_key: "openai", operation: "generate_campaign_brief", model, status,
      latency_ms: Date.now() - started, retry_count: retryCount, cache_hit: false, failure_code: failure,
    });
    redirect("/brand/plan?campaign=" + campaign.id + "&error=" + (status === "rate_limited" ? "provider_limit" : "generation"));
  }

  let brief: Brief;
  try { brief = JSON.parse(raw) as Brief; } catch { redirect("/brand/plan?campaign=" + campaign.id + "&error=generation"); }
  const validIds = new Set(evidence.map((item) => item.id));
  for (const claim of [...brief.pain_areas, ...brief.usp_hypotheses]) {
    claim.evidence_ids = [...new Set(claim.evidence_ids)].filter((id) => validIds.has(id));
  }
  if ([...brief.pain_areas, ...brief.usp_hypotheses].some((claim) => claim.evidence_ids.length === 0)) {
    await supabase.from("external_api_usage_events").insert({
      company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
      provider_key: "openai", operation: "generate_campaign_brief", model, status: "failed",
      latency_ms: Date.now() - started, retry_count: retryCount, failure_code: "invalid_citations",
    });
    redirect("/brand/plan?campaign=" + campaign.id + "&error=generation");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("brand_campaign_plans").upsert({
    campaign_id: campaign.id, company_id: ctx.companyId, brief: brief as unknown as Json,
    approval_state: "draft", generated_model: model, generated_at: now, approved_at: null, updated_at: now,
  }, { onConflict: "campaign_id" });
  await supabase.from("external_api_usage_events").insert({
    company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
    provider_key: "openai", operation: "generate_campaign_brief", model,
    status: error ? "failed" : "success", latency_ms: Date.now() - started, retry_count: retryCount,
    cache_hit: false, input_units: completion?.usage?.prompt_tokens ?? null,
    output_units: completion?.usage?.completion_tokens ?? null, unit_type: "token",
    failure_code: error ? "brief_save_failed" : null,
  });
  if (error) redirect("/brand/plan?campaign=" + campaign.id + "&error=save");
  revalidatePath("/brand/plan");
  redirect("/brand/plan?campaign=" + campaign.id + "&generated=1");
}

export async function saveCampaignBriefAction(formData: FormData) {
  const ctx = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns").select("id")
    .eq("id", campaignId).eq("company_id", ctx.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home?error=campaign");
  const { data: plan } = await supabase.from("brand_campaign_plans").select("brief")
    .eq("campaign_id", campaign.id).eq("company_id", ctx.companyId).maybeSingle();
  if (!plan) redirect("/brand/plan?campaign=" + campaign.id + "&error=no_plan");

  const old = plan.brief as unknown as Brief;
  const lines = (name: string) => String(formData.get(name) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const claims = (name: string, prior: Claim[]) => lines(name).map((statement, i) => ({
    statement: statement.slice(0, 700), evidence_ids: prior[i]?.evidence_ids ?? [],
  }));
  const updated: Brief = {
    summary: String(formData.get("summary") ?? "").trim().slice(0, 1200),
    pain_areas: claims("pain_areas", old.pain_areas ?? []),
    usp_hypotheses: claims("usp_hypotheses", old.usp_hypotheses ?? []),
    recommended_angle: String(formData.get("recommended_angle") ?? "").trim().slice(0, 700),
    creator_brief: String(formData.get("creator_brief") ?? "").trim().slice(0, 1200),
    must_include: lines("must_include").slice(0, 12), must_avoid: lines("must_avoid").slice(0, 12),
  };
  const { error } = await supabase.from("brand_campaign_plans").update({
    brief: updated as unknown as Json, approval_state: "draft", approved_at: null, updated_at: new Date().toISOString(),
  }).eq("campaign_id", campaign.id).eq("company_id", ctx.companyId);
  if (error) redirect("/brand/plan?campaign=" + campaign.id + "&error=save");
  revalidatePath("/brand/plan");
  redirect("/brand/plan?campaign=" + campaign.id + "&saved=1");
}

export async function approveCampaignBriefAction(formData: FormData) {
  const ctx = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns").select("id")
    .eq("id", campaignId).eq("company_id", ctx.companyId).maybeSingle();
  if (!campaign) redirect("/brand/home?error=campaign");
  const now = new Date().toISOString();
  const { error } = await supabase.from("brand_campaign_plans").update({
    approval_state: "approved", approved_at: now, updated_at: now,
  }).eq("campaign_id", campaign.id).eq("company_id", ctx.companyId);
  if (error) redirect("/brand/plan?campaign=" + campaign.id + "&error=save");
  await supabase.from("brand_campaigns").update({ status: "ready_for_desk", updated_at: now })
    .eq("id", campaign.id).eq("company_id", ctx.companyId);
  revalidatePath("/brand/home");
  redirect("/brand/plan?campaign=" + campaign.id + "&approved=1");
}
