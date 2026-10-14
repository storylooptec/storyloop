import "server-only";

import { normalizeSearchApiParams, sanitizeSearchApiPayload, type SearchApiPayload } from "@/brand/research-normalize";
import { objectValue } from "@/brand/competition";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

export class SearchApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryAfter: number | null;
  readonly uncertain: boolean;
  readonly requestId: string | null;
  constructor(code: string, status: number | null = null, retryAfter: number | null = null, uncertain = false, requestId: string | null = null) {
    super(code);
    this.name = "SearchApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.uncertain = uncertain;
    this.requestId = requestId;
  }
}

function retryDelay(value: string | null): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(1, Math.ceil(seconds))) : null;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES || !response.body) {
    await response.body?.cancel();
    throw new SearchApiError("provider_invalid_response", response.status, null, true);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SearchApiError("provider_response_too_large", response.status, null, true);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SearchApiError) throw error;
    throw new SearchApiError("provider_invalid_response", response.status, null, true);
  } finally { reader.releaseLock(); }
}

async function request(endpoint: URL, apiKey: string, signal?: AbortSignal): Promise<unknown> {
  if (!apiKey.trim() || /[\r\n]/.test(apiKey)) throw new SearchApiError("provider_not_configured");
  if (signal?.aborted) throw new SearchApiError("provider_cancelled");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: controller.signal });
    } catch {
      throw new SearchApiError(signal?.aborted ? "provider_cancelled" : controller.signal.aborted ? "provider_timeout" : "provider_unavailable", null, null, true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const code = response.status === 429 ? "provider_rate_limited" : [401, 403].includes(response.status) ? "provider_auth_failed" : response.status >= 500 ? "provider_unavailable" : "provider_request_failed";
      throw new SearchApiError(code, response.status, retryDelay(response.headers.get("retry-after")));
    }
    try { return await boundedJson(response); } catch (error) {
      if (controller.signal.aborted) throw new SearchApiError(signal?.aborted ? "provider_cancelled" : "provider_timeout", response.status, null, true);
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

/** The caller MUST reserve one paid attempt before calling. No retries, pagination or background fan-out. */
export async function callSearchApi(params: Record<string, string>, apiKey: string, signal?: AbortSignal): Promise<SearchApiPayload> {
  let normalized: Record<string, string>;
  try { normalized = normalizeSearchApiParams(params); } catch { throw new SearchApiError("provider_invalid_parameters"); }
  const endpoint = new URL("https://www.searchapi.io/api/v1/search");
  for (const [key, value] of Object.entries(normalized)) endpoint.searchParams.set(key, value);
  const body = objectValue(await request(endpoint, apiKey, signal));
  const status = objectValue(body.search_metadata).status;
  const rawId = objectValue(body.search_metadata).id;
  const requestId = typeof rawId === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(rawId) ? rawId : null;
  if (body.error || body.errors || (status !== undefined && status !== "Success")) throw new SearchApiError("provider_search_failed", 200, null, true, requestId);
  const expected = normalized.engine === "google" ? "organic_results" : ["meta_ad_library", "linkedin_ad_library", "reddit_ad_library"].includes(normalized.engine) ? "ads" : normalized.engine === "meta_ad_library_page_search" ? "page_results" : normalized.engine === "facebook_business_page_reviews" ? "reviews" : normalized.engine === "facebook_business_page" ? "page" : normalized.engine === "google_ads_transparency_center" ? "ad_creatives" : normalized.engine === "instagram_comments" ? "comments" : "posts";
  // Valid empty results may omit the array but still supply Success or total_results: 0.
  if (!Array.isArray(body[expected]) && !(normalized.engine === "facebook_business_page" && Object.keys(objectValue(body.page)).length) && !(normalized.engine === "instagram_profile" && Object.keys(objectValue(body.profile)).length) && status !== "Success" && objectValue(body.search_information).total_results !== 0) throw new SearchApiError("provider_invalid_response", 200, null, true);
  return sanitizeSearchApiPayload(body, normalized);
}

export type SearchApiAccount = {
  monthlyUsed: number;
  monthlyAllowance: number;
  remainingCredits: number;
  searchesThisHour: number;
  hourlyRateLimit: number;
  hourlyRemaining: number;
};

/** Account checks are separate from paid search attempts; no account identity or billing data retained. */
export async function fetchSearchApiAccount(apiKey: string, signal?: AbortSignal): Promise<SearchApiAccount> {
  const body = objectValue(await request(new URL("https://www.searchapi.io/api/v1/me"), apiKey, signal));
  const account = objectValue(body.account);
  const usage = objectValue(body.api_usage);
  const values = [account.current_month_usage, account.monthly_allowance, account.remaining_credits, usage.searches_this_hour, usage.hourly_rate_limit];
  if (!values.every(value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) throw new SearchApiError("provider_invalid_response", 200);
  const [monthlyUsed, monthlyAllowance, remainingCredits, searchesThisHour, hourlyRateLimit] = values as number[];
  return { monthlyUsed, monthlyAllowance, remainingCredits, searchesThisHour, hourlyRateLimit, hourlyRemaining: Math.max(0, hourlyRateLimit - searchesThisHour) };
}
