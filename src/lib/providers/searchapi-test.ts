import "server-only";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { callSearchApi, SearchApiError } from "./searchapi";

const QUERY = "oral care toothpaste brands India";
const WINDOW_MS = 5 * 60 * 1000;

export type SearchApiTestResult = {
  ok: boolean;
  query: string;
  checkedAt: string;
  durationMs: number;
  httpStatus: number | null;
  code: string | null;
  message: string;
  results: { title: string; url: string; snippet: string }[];
  reused: boolean;
  retryAt: number;
};

const messages: Record<string, string> = {
  provider_auth_failed: "SearchAPI rejected the key. Check the key linked to this deployment.",
  provider_rate_limited: "SearchAPI returned a rate or credit limit. Check your SearchAPI account.",
  provider_timeout: "SearchAPI did not respond within 20 seconds. No automatic retry was sent.",
  provider_unavailable: "SearchAPI could not be reached or returned a server error. No automatic retry was sent.",
  provider_request_failed: "SearchAPI rejected this test request.",
  provider_search_failed: "SearchAPI responded, but reported that the search failed.",
  provider_invalid_response: "SearchAPI responded, but the response was not a valid search result.",
  provider_response_too_large: "SearchAPI's response exceeded the test's size limit.",
};

const inFlight = new Map<string, Promise<SearchApiTestResult>>();

/** Diagnostic only: a fixed query, no research database, OpenAI, retries or pagination. */
export async function testSearchApi(): Promise<SearchApiTestResult> {
  const apiKey = (process.env.SEARCHAPI_API_KEY || process.env.SEARCHAPI_KEY || process.env.SEARCH_API_KEY || "").trim();
  const now = Date.now();
  const initial: SearchApiTestResult = {
    ok: false, query: QUERY, checkedAt: new Date(now).toISOString(), durationMs: 0,
    httpStatus: null, code: null, message: "", results: [], reused: false, retryAt: 0,
  };
  if (!apiKey || /[\r\n]/.test(apiKey)) return {
    ...initial, code: "provider_not_configured",
    message: "This deployment cannot read a valid SearchAPI key. Link SEARCHAPI_API_KEY, SEARCHAPI_KEY or SEARCH_API_KEY to this environment and redeploy. No search request was sent.",
  };
  if (process.env.SEARCHAPI_ENABLED === "false") return {
    ...initial, code: "provider_disabled", message: "SEARCHAPI_ENABLED is false in this deployment. No search request was sent.",
  };

  const bucket = Math.floor(now / WINDOW_MS);
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const cacheKey = `${keyHash}:${bucket}`;
  const existing = inFlight.get(cacheKey);
  if (existing) return { ...await existing, reused: true };

  const pending = (async () => {
    let requested = false;
    // Fixed-window keys avoid stale-while-revalidate sending a hidden background search.
    // Next's shared Data Cache also reuses failures; an ambiguous timeout isn't retried.
    const cached = unstable_cache(async (): Promise<SearchApiTestResult> => {
      requested = true;
      const started = Date.now();
      const base = { ...initial, checkedAt: new Date(started).toISOString(), retryAt: (bucket + 1) * WINDOW_MS };
      try {
        const response = await callSearchApi({ engine: "google", q: QUERY, gl: "in", hl: "en" }, apiKey);
        return {
          ...base, ok: true, httpStatus: 200, durationMs: Date.now() - started,
          message: response.hits.length ? "SearchAPI is working. The search returned results." : "SearchAPI is working. The search returned no organic results.",
          results: response.hits.slice(0, 5).map(({ title, url, snippet }) => ({ title, url, snippet })),
        };
      } catch (error) {
        const code = error instanceof SearchApiError ? error.code : "test_unavailable";
        return {
          ...base, durationMs: Date.now() - started, code,
          httpStatus: error instanceof SearchApiError ? error.status : null,
          message: messages[code] ?? "The test could not finish. No automatic retry was sent.",
        };
      }
    }, ["searchapi-campaign-test-v1", cacheKey], { revalidate: false });
    const result = await cached();
    return { ...result, reused: !requested };
  })();
  inFlight.set(cacheKey, pending);
  try { return await pending; } finally { inFlight.delete(cacheKey); }
}
