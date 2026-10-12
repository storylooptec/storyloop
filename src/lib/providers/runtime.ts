import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

export type Provider = "serpapi" | "openai" | "higgsfield";
export class ProviderError extends Error {
  constructor(public readonly code: string, public readonly retryAfterSeconds = 60,
    public readonly usage?: { inputUnits?: number; outputUnits?: number; estimatedCostUsd?: number | null; providerRequestId?: string }) {
    super(code); this.name = "ProviderError";
  }
}
type Context = { companyId: string; campaignId: string; userId: string; provider: Provider;
  operation: string; model?: string; idempotencyKey?: string; estimatedCostUsd?: number | null };
type Result<T> = { value: T; inputUnits?: number; outputUnits?: number; unitType?: string;
  estimatedCostUsd?: number | null; providerRequestId?: string; retryCount?: number; cacheHit?: boolean };

/** A durable reservation precedes the external request; concurrent calls and spend share one DB lock. */
export async function runProviderOperation<T>(input: Context,
  work: (scope: { eventId: string }) => Promise<Result<T>>): Promise<T> {
  const db = createServiceSupabaseClient();
  const enabled = input.provider === "serpapi" ? process.env.SERP_API_ENABLED === "true"
    : input.provider === "higgsfield" ? process.env.HIGGSFIELD_API_ENABLED === "true"
    : process.env.OPENAI_API_ENABLED !== "false";
  if (!enabled) throw new ProviderError("provider_disabled");
  const { data, error } = await db.rpc("begin_provider_operation", {
    target_company_id: input.companyId, target_campaign_id: input.campaignId, actor_id: input.userId,
    provider: input.provider, operation_name: input.operation, model_name: input.model ?? null,
    dedupe_key: input.idempotencyKey ?? randomUUID(), reserved_cost: input.estimatedCostUsd ?? null,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new ProviderError("usage_reservation_failed");
  const reservation = data as { allowed?: boolean; event_id?: string; error?: string };
  if (!reservation.allowed || !reservation.event_id) throw new ProviderError(reservation.error || "operation_blocked");
  const started = Date.now();
  const eventId = reservation.event_id;
  let result: Result<T>;
  try { result = await work({ eventId }); }
  catch (cause) {
    const failure = cause instanceof ProviderError ? cause : new ProviderError("provider_request_failed");
    const status = failure.code === "provider_rate_limited" ? "rate_limited"
      : failure.code === "submission_unknown" || failure.code === "provider_timeout" ? "unknown" : "failed";
    const outcome = { status, latency_ms: Date.now() - started, failure_code: failure.code,
      retry_after: Math.max(1, Math.min(3600, failure.retryAfterSeconds)),
      input_units: failure.usage?.inputUnits ?? null, output_units: failure.usage?.outputUnits ?? null,
      estimated_cost_usd: failure.usage?.estimatedCostUsd ?? input.estimatedCostUsd ?? null,
      provider_request_id: failure.usage?.providerRequestId ?? null };
    const { error: failureLogError } = await db.rpc("finish_provider_operation", { event_id: eventId, outcome: outcome as Json });
    if (failureLogError) throw new ProviderError("usage_finalization_failed");
    throw failure;
  }
  const { error: logError } = await db.rpc("finish_provider_operation", { event_id: eventId,
    outcome: { status: result.cacheHit ? "cached" : "success", latency_ms: Date.now() - started,
      retry_count: result.retryCount ?? 0, cache_hit: result.cacheHit ?? false,
      input_units: result.inputUnits ?? null, output_units: result.outputUnits ?? null,
      unit_type: result.unitType ?? null, estimated_cost_usd: result.estimatedCostUsd ?? input.estimatedCostUsd ?? null,
      provider_request_id: result.providerRequestId ?? null } as Json,
  });
  if (logError) throw new ProviderError("usage_finalization_failed");
  return result.value;
}

export function configuredOpenAICost(inputTokens: number, outputTokens: number): number | null {
  const a = process.env.OPENAI_INPUT_COST_PER_1M_USD;
  const b = process.env.OPENAI_OUTPUT_COST_PER_1M_USD;
  if (!a || !b) return null;
  const rates = [Number(a), Number(b)];
  return rates.every((n) => Number.isFinite(n) && n >= 0)
    ? (inputTokens * rates[0] + outputTokens * rates[1]) / 1_000_000 : null;
}

/** Local cache reads have no provider quota/circuit dependency and cost no additional request. */
export async function recordCachedOperation(input: Context): Promise<void> {
  const db = createServiceSupabaseClient();
  const { data: member } = await db.from("brand_memberships").select("company_id")
    .eq("company_id",input.companyId).eq("user_id",input.userId).eq("status","active").maybeSingle();
  const { data: campaign } = await db.from("brand_campaigns").select("id")
    .eq("id",input.campaignId).eq("company_id",input.companyId).maybeSingle();
  if (!member || !campaign) throw new ProviderError("access_denied");
  const { error } = await db.from("external_api_usage_events").insert({company_id:input.companyId,
    campaign_id:input.campaignId,actor_user_id:input.userId,provider_key:input.provider,operation:input.operation,
    model:input.model??null,status:"cached",cache_hit:true,input_units:0,estimated_cost_usd:0,completed_at:new Date().toISOString()});
  if (error) throw new ProviderError("usage_finalization_failed");
}
