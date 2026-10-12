import "server-only";

import { SEARCH_CACHE_MS, normalizeSearchParams, objectValue, sanitizeSearchPayload, searchCacheKey, type SafeSearchPayload, type SearchParams } from "@/brand/competition";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { ProviderError, recordCachedOperation, runProviderOperation } from "@/lib/providers/runtime";
import type { Json } from "@/types/database.types";

export type SearchContext = { companyId: string; campaignId: string; userId: string };
export type SearchSnapshot = { payload: SafeSearchPayload; observedAt: string; cacheHit: boolean };

function searchUnitCost(): number | null {
  const raw = process.env.SERP_API_COST_PER_SEARCH_USD;
  if (!raw?.trim()) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Fixed provider origin and allowlisted params; no arbitrary URL is fetched or logged. */
export async function searchSerpApi(context: SearchContext, params: SearchParams, operation: string): Promise<SearchSnapshot> {
  const supabase = createServiceSupabaseClient();
  const cacheKey = searchCacheKey(params);
  const now = new Date();
  const { data: cached } = await supabase.from("brand_search_cache").select("payload,fetched_at")
    .eq("company_id", context.companyId).eq("cache_key", cacheKey).gt("expires_at", now.toISOString()).maybeSingle();
  if (cached && Array.isArray(objectValue(cached.payload).hits) && Array.isArray(objectValue(cached.payload).reviews)) {
    await recordCachedOperation({ ...context, provider: "serpapi", operation });
    return { payload: cached.payload as unknown as SafeSearchPayload, observedAt: cached.fetched_at, cacheHit: true };
  }
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey || process.env.SERP_API_ENABLED !== "true") throw new ProviderError("provider_not_configured");
  const endpoint = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(normalizeSearchParams(params))) endpoint.searchParams.set(key, value);
  endpoint.searchParams.set("api_key", apiKey);
  const unitCost = searchUnitCost();
  const payload = await runProviderOperation({ ...context, provider: "serpapi", operation, estimatedCostUsd: unitCost ?? undefined }, async () => {
    const deadline = Date.now() + 15000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining < 250) throw new ProviderError("provider_timeout");
      let response: Response;
      try {
        response = await fetch(endpoint, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(Math.min(8000, remaining)) });
      } catch {
        if (attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 200)); continue; }
        throw new ProviderError("provider_timeout");
      }
      if (response.status === 429) throw new ProviderError("provider_rate_limited", 3600);
      if (response.status >= 500 && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 200)); continue; }
      if (!response.ok) throw new ProviderError(response.status === 401 ? "provider_auth_failed" : "provider_request_failed");
      let body: unknown;
      try { body = await response.json(); } catch { throw new ProviderError("provider_invalid_response"); }
      const record = objectValue(body);
      const status = objectValue(record.search_metadata).status;
      // SerpApi marks legitimate empty results Success, and may include an explanatory error string.
      if (status !== "Success") throw new ProviderError("provider_search_failed");
      const value = sanitizeSearchPayload(body, params);
      return { value, inputUnits: 1, unitType: "search", estimatedCostUsd: unitCost, providerRequestId: value.searchId ?? undefined, retryCount: attempt };
    }
    throw new ProviderError("provider_unavailable");
  });
  const observedAt = new Date().toISOString();
  // A cache write failure does not discard a valid, attributable search response.
  await supabase.from("brand_search_cache").upsert({ company_id: context.companyId, cache_key: cacheKey, engine: params.engine, payload: payload as unknown as Json, provider_search_id: payload.searchId, fetched_at: observedAt, expires_at: new Date(Date.now() + SEARCH_CACHE_MS).toISOString() }, { onConflict: "company_id,cache_key" });
  return { payload, observedAt, cacheHit: false };
}
