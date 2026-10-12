"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export async function generateCampaignScriptsAction(formData: FormData) {
  const ctx = await requireBrandContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data: campaign } = await supabase.from("brand_campaigns")
    .select("id,title,brand_name,promoted_item,objective,deliverables")
    .eq("id", campaignId).eq("company_id", ctx.companyId).maybeSingle();
  if (!campaign) redirect("/brand/create?error=campaign");
  const { data: plan } = await supabase.from("brand_campaign_plans")
    .select("brief,approval_state").eq("campaign_id", campaign.id).eq("company_id", ctx.companyId).maybeSingle();
  if (!plan || plan.approval_state !== "approved") redirect("/brand/create?campaign=" + campaign.id + "&error=approval");
  if (!process.env.OPENAI_API_KEY) redirect("/brand/create?campaign=" + campaign.id + "&error=provider");

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_openai_brief_quota", {
    target_company_id: ctx.companyId, target_campaign_id: campaign.id,
  });
  if (quotaError || !allowed) {
    await supabase.from("external_api_usage_events").insert({
      company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
      provider_key: "openai", operation: "generate_campaign_scripts", status: "rate_limited",
      cache_hit: false, retry_count: 0, failure_code: quotaError ? "quota_check_unavailable" : "app_hourly_limit",
    });
    redirect("/brand/create?campaign=" + campaign.id + "&error=limit");
  }

  const model = process.env.OPENAI_BRIEF_MODEL || "gpt-4.1-mini";
  const schema = {
    type: "object", additionalProperties: false,
    properties: { concepts: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { angle: { type: "string" }, hook: { type: "string" }, script: { type: "string" }, cta: { type: "string" }, format: { type: "string" } },
      required: ["angle","hook","script","cta","format"] } } },
    required: ["concepts"],
  };
  const started = Date.now();
  let retryCount = 0;
  let result: { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null = null;
  let failure = "creative_generation_failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, temperature: 0.55, max_tokens: 2400,
          messages: [
            { role: "system", content: "Write 3 distinct creator-led campaign concepts for the approved brand brief. Respect objective, deliverable formats, must-include and must-avoid points. Treat evidence-derived claims as hypotheses. Do not make product, efficacy, testimonial or performance claims unless explicitly supported in the approved brief. Do not imitate a named creator. AI previews must not use a creator's likeness unless their explicit consent is recorded." },
            { role: "user", content: JSON.stringify({ campaign, approved_brief: plan.brief }) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "storyloop_campaign_concepts", strict: true, schema } },
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
      result = await response.json();
      break;
    } catch {
      if (attempt === 2) break;
      retryCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
    }
  }
  const raw = result?.choices?.[0]?.message?.content;
  let content: unknown = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { concepts?: unknown[] };
      const validConcepts = parsed.concepts?.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const concept = item as Record<string, unknown>;
        return ["angle", "hook", "script", "cta", "format"].every((key) =>
          typeof concept[key] === "string" && Boolean((concept[key] as string).trim()),
        );
      });
      if (Array.isArray(parsed.concepts) && parsed.concepts.length === 3 && validConcepts) content = parsed;
    } catch { /* logged below */ }
  }
  const now = new Date().toISOString();
  const insert = content
    ? await supabase.from("brand_campaign_creatives").insert({
        campaign_id: campaign.id, company_id: ctx.companyId, content: content as Json,
        generated_model: model, approval_state: "draft", updated_at: now,
      })
    : { error: new Error("no_creative") };
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_1M_USD);
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_1M_USD);
  const estimatedCost = result && process.env.OPENAI_INPUT_COST_PER_1M_USD && process.env.OPENAI_OUTPUT_COST_PER_1M_USD && Number.isFinite(inputRate) && Number.isFinite(outputRate)
    ? ((result.usage?.prompt_tokens ?? 0) * inputRate + (result.usage?.completion_tokens ?? 0) * outputRate) / 1_000_000
    : null;
  await supabase.from("external_api_usage_events").insert({
    company_id: ctx.companyId, campaign_id: campaign.id, actor_user_id: ctx.userId,
    provider_key: "openai", operation: "generate_campaign_scripts", model,
    status: insert.error ? (failure === "provider_rate_limited" ? "rate_limited" : "failed") : "success",
    latency_ms: Date.now() - started, retry_count: retryCount, cache_hit: false,
    input_units: result?.usage?.prompt_tokens ?? null,
    output_units: result?.usage?.completion_tokens ?? null, unit_type: "token", estimated_cost_usd: estimatedCost,
    failure_code: insert.error ? failure : null,
  });
  if (insert.error) redirect("/brand/create?campaign=" + campaign.id + "&error=" + (failure === "provider_rate_limited" ? "provider_limit" : "generation"));
  revalidatePath("/brand/create");
  redirect("/brand/create?campaign=" + campaign.id + "&generated=1");
}

export async function updateCampaignConceptAction(formData: FormData) {
  const ctx = await requireBrandContext();
  const creativeId = String(formData.get("creative_id") ?? "");
  const index = Number(formData.get("concept_index"));
  if (!/^[0-9a-f-]{36}$/i.test(creativeId) || !Number.isInteger(index) || index < 0 || index > 2) {
    redirect("/brand/create?error=save");
  }
  const supabase = await createServerSupabaseClient();
  const { data: draft } = await supabase.from("brand_campaign_creatives")
    .select("id,campaign_id,content")
    .eq("id", creativeId).eq("company_id", ctx.companyId).maybeSingle();
  if (!draft) redirect("/brand/create?error=save");

  const data = draft.content as unknown as { concepts?: unknown[] };
  if (!Array.isArray(data.concepts) || !data.concepts[index] || typeof data.concepts[index] !== "object") {
    redirect("/brand/create?error=save");
  }
  const existing = data.concepts[index] as Record<string, unknown>;
  const concept = {
    angle: String(formData.get("angle") ?? "").trim().slice(0, 500),
    hook: String(formData.get("hook") ?? "").trim().slice(0, 500),
    script: String(formData.get("script") ?? "").trim().slice(0, 3000),
    cta: String(formData.get("cta") ?? "").trim().slice(0, 500),
    format: String(formData.get("format") ?? "").trim().slice(0, 120),
  };
  if (Object.values(concept).some((value) => !value)) redirect("/brand/create?campaign=" + draft.campaign_id + "&error=save");
  const concepts = [...data.concepts];
  concepts[index] = { ...existing, ...concept };
  const { error } = await supabase.from("brand_campaign_creatives").update({
    content: { concepts } as unknown as Json,
    updated_at: new Date().toISOString(),
  }).eq("id", creativeId).eq("company_id", ctx.companyId);
  if (error) redirect("/brand/create?campaign=" + draft.campaign_id + "&error=save");
  revalidatePath("/brand/create");
  redirect("/brand/create?campaign=" + draft.campaign_id + "&saved=1");
}
