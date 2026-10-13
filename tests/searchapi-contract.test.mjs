import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile only the server boundary for Node tests; production keeps server-only.
const competitionUrl = new URL("../src/brand/competition.ts", import.meta.url).href;
const normalizerSource = (await readFile(new URL("../src/brand/research-normalize.ts", import.meta.url), "utf8")).replace('from "./competition"', `from ${JSON.stringify(competitionUrl)}`);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`;
const normalizerUrl = moduleUrl(normalizerSource);
const { normalizeSearchApiParams, sanitizeSearchApiPayload, instagramUsernameFromUrl } = await import(normalizerUrl);
const adapterSource = (await readFile(new URL("../src/lib/providers/searchapi.ts", import.meta.url), "utf8")).replace('import "server-only";', "").replace('from "@/brand/research-normalize"', `from ${JSON.stringify(normalizerUrl)}`).replace('from "@/brand/competition"', `from ${JSON.stringify(competitionUrl)}`);
const { callSearchApi, fetchSearchApiAccount, SearchApiError } = await import(moduleUrl(adapterSource));

test("first-page parameter allowlist rejects unsupported engines and drops credentials/pagination", () => {
  assert.deepEqual(normalizeSearchApiParams({ engine: "google", q: " Beta   toothpaste ", next_page_token: "secret", api_key: "secret", url: "https://attacker.example/" }), { engine: "google", q: "Beta toothpaste", gl: "in", hl: "en" });
  assert.throws(() => normalizeSearchApiParams({ engine: "google", q: " " }));
  assert.throws(() => normalizeSearchApiParams({ engine: "google_ads_transparency_center", domain: "http://localhost" }));
  assert.throws(() => normalizeSearchApiParams({ engine: "unknown", q: "Beta" }));
  assert.equal(normalizeSearchApiParams({ engine: "google_ads_transparency_center", domain: "beta.example", region: "IN" }).region, "IN");
  assert.deepEqual(normalizeSearchApiParams({ engine: "instagram_comments", post_id: "https://www.instagram.com/reel/DbL6n0ggXDZ/" }), { engine: "instagram_comments", post_id: "DbL6n0ggXDZ" });
  assert.equal(instagramUsernameFromUrl("https://instagram.com/beta.in/"), "beta.in");
  assert.equal(instagramUsernameFromUrl("https://instagram.com/p/Ab123456/"), null);
  assert.equal(instagramUsernameFromUrl("https://instagram.com.attacker.example/beta/"), null);
});

// Shapes below follow the official docs, with synthetic brand/copy data (no live request).
test("Google evidence preserves source links and Instagram identity candidates without raw metadata", () => {
  const result = sanitizeSearchApiPayload({ search_metadata: { id: "search_123", json_url: "secret" }, search_parameters: { api_key: "secret" }, organic_results: [
    { title: "Beta official", link: "https://beta.example/products?api_key=secret&utm_source=ads", snippet: "Toothpaste", date: "2 days ago" },
    { title: "Beta Instagram", link: "https://www.instagram.com/beta.brand/", snippet: "Oral care" },
    { title: "Unsafe", link: "javascript:alert(1)" },
  ] }, { engine: "google" });
  assert.equal(result.hits.length, 2);
  assert.equal(result.hits[0].url, "https://beta.example/products");
  assert.equal(result.hits[0].price, null);
  assert.equal(result.instagramUsername, "beta.brand");
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.deepEqual(result.evidence, []);
});

test("Meta whitelist keeps landing-domain evidence but never asserts brand matching", () => {
  const result = sanitizeSearchApiPayload({ ads: [{ ad_archive_id: "1234567", page_id: "76543", is_active: true, start_date: "2026-10-01T00:00:00Z", publisher_platform: ["FACEBOOK", "INSTAGRAM"], snapshot: { page_name: "Beta", page_profile_uri: "https://www.facebook.com/beta/", body: { text: "Meet our new toothpaste." }, link_url: "https://shop.beta.example/product", display_format: "VIDEO", cta_text: "Shop now", cards: [{ title: "Beta toothpaste", link_url: "https://beta.example/product" }], extra_texts: ["DO NOT STORE"], videos: [{ sensitive: "DO NOT STORE" }] }, ad_details_token: "SECRET" }] }, { engine: "meta_ad_library" });
  const ad = result.evidence[0];
  assert.equal(ad.url, "https://www.facebook.com/ads/library/?id=1234567");
  assert.equal(ad.text, "Meet our new toothpaste.");
  assert.equal(ad.attributes.targetDomain, "shop.beta.example");
  assert.equal(ad.attributes.advertiser, "Beta");
  assert.equal(ad.attributes.verified, undefined);
  assert.deepEqual(ad.attributes.platforms, ["FACEBOOK", "INSTAGRAM"]);
  assert.equal(JSON.stringify(result).includes("SECRET"), false);
  assert.equal(JSON.stringify(result).includes("DO NOT STORE"), false);
});

test("Google ads retain dates and advertiser attribution, never script previews or invented copy", () => {
  const payload = { ad_creatives: [{ id: "CR123", target_domain: "beta.example", advertiser: { id: "AR456", name: "Beta Ltd" }, first_shown_datetime: "2026-09-01T10:00:00Z", last_shown_datetime: "2026-10-01T10:00:00Z", format: "video", details_link: "https://adstransparency.google.com/advertiser/AR456/creative/CR123?region=anywhere", details_script_link: "https://attacker.example/code.js" }] };
  const result = sanitizeSearchApiPayload(payload, { engine: "google_ads_transparency_center" });
  assert.equal(result.evidence[0].attributes.targetDomain, "beta.example");
  assert.equal(result.evidence[0].attributes.lastShownDate, "2026-10-01T10:00:00Z");
  assert.equal(result.evidence[0].text, "");
  assert.equal(JSON.stringify(result).includes("code.js"), false);
});

test("Instagram source uses permalink/shortcode and real comments, excluding author personal profiles", () => {
  const profile = sanitizeSearchApiPayload({ profile: { username: "beta.brand", external_link: "https://beta.example/?utm_source=ig" }, posts: [{ id: "DbL6n0ggXDZ", permalink: "https://www.instagram.com/reel/DbL6n0ggXDZ/", link: "https://cdn.example/photo.jpg", caption: "Our new product", likes: 300, comments: 20, iso_date: "2026-10-01T00:00:00Z", type: "reel" }] }, { engine: "instagram_profile" });
  assert.equal(profile.profileWebsite, "https://beta.example/");
  assert.equal(profile.postId, "DbL6n0ggXDZ");
  assert.equal(profile.evidence[0].url, "https://www.instagram.com/reel/DbL6n0ggXDZ/");
  const comments = sanitizeSearchApiPayload({ post: { id: "DbL6n0ggXDZ", permalink: "https://www.instagram.com/reel/DbL6n0ggXDZ/", user: { username: "beta.brand" } }, comments: [{ id: "123", text: "I liked the flavour", iso_date: "2026-10-02T00:00:00Z", likes: 0, user: { username: "personal_identity", avatar: "private" } }, { id: "456", text: "", summary: "Everyone loves it" }], ai_summary: "All positive" }, { engine: "instagram_comments", post_id: "DbL6n0ggXDZ" });
  assert.equal(comments.evidence.length, 1);
  assert.equal(comments.evidence[0].text, "I liked the flavour");
  assert.equal(comments.evidence[0].attributes.likes, 0);
  assert.equal(comments.evidence[0].url, profile.evidence[0].url);
  for (const excluded of ["personal_identity", "private", "Everyone loves", "All positive"]) assert.equal(JSON.stringify(comments).includes(excluded), false);
});

test("output bounds retain missing metrics as unavailable", () => {
  const result = sanitizeSearchApiPayload({ posts: Array.from({ length: 100 }, (_, n) => ({ id: `ABCDE${n}`, caption: "x".repeat(5000), likes: -1, comments: "10" })) }, { engine: "instagram_profile" });
  assert.equal(result.evidence.length, 12);
  assert.equal(result.evidence[0].text.length, 1800);
  assert.equal(result.evidence[0].attributes.likes, null);
  assert.equal(result.evidence[0].attributes.comments, null);
});

async function withFetch(impl, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try { await run(); } finally { globalThis.fetch = previous; }
}

test("one direct request uses Bearer authentication and never follows pagination", async () => {
  let calls = 0;
  await withFetch(async (url, init) => {
    calls++;
    assert.equal(url.origin, "https://www.searchapi.io");
    assert.equal(url.pathname, "/api/v1/search");
    assert.equal(url.searchParams.has("api_key"), false);
    assert.equal(url.searchParams.has("next_page_token"), false);
    assert.equal(init.headers.Authorization, "Bearer test-secret");
    assert.equal(init.redirect, "error");
    return Response.json({ search_metadata: { status: "Success" }, organic_results: [], pagination: { next_page_token: "expensive-next-page" } });
  }, async () => { assert.deepEqual((await callSearchApi({ engine: "google", q: "Beta" }, "test-secret")).hits, []); });
  assert.equal(calls, 1);
});

test("rate limits expose safe retry seconds and never retry or echo provider bodies", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response("private-secret-error-body", { status: 429, headers: { "Retry-After": "90" } }); }, async () => {
    await assert.rejects(callSearchApi({ engine: "google", q: "Beta" }, "test-secret"), error => error instanceof SearchApiError && error.code === "provider_rate_limited" && error.status === 429 && error.retryAfter === 90 && error.uncertain === false && !String(error).includes("private-secret"));
  });
  assert.equal(calls, 1);
});

test("unknown transport outcome is marked uncertain; malformed and oversized payloads fail closed", async () => {
  await withFetch(async () => { throw new Error("URL carrying private secrets"); }, async () => {
    await assert.rejects(callSearchApi({ engine: "google", q: "Beta" }, "test-secret"), error => error.code === "provider_unavailable" && error.uncertain && !String(error).includes("private"));
  });
  for (const response of [new Response("<html>Error</html>"), Response.json({ unexpected: "payload" }), new Response("a".repeat(2 * 1024 * 1024 + 1))]) {
    await withFetch(async () => response, async () => { await assert.rejects(callSearchApi({ engine: "google", q: "Beta" }, "test-secret"), error => error instanceof SearchApiError && error.uncertain); });
  }
});

test("account stats expose only validated quota numbers and reject missing fields", async () => {
  await withFetch(async url => {
    assert.equal(url.pathname, "/api/v1/me");
    return Response.json({ account: { current_month_usage: 4800, monthly_allowance: 10000, remaining_credits: 5200, email: "private@example.test" }, api_usage: { searches_this_hour: 250, hourly_rate_limit: 1000 }, api_key: "secret" });
  }, async () => { assert.deepEqual(await fetchSearchApiAccount("test-secret"), { monthlyUsed: 4800, monthlyAllowance: 10000, remainingCredits: 5200, searchesThisHour: 250, hourlyRateLimit: 1000, hourlyRemaining: 750 }); });
  await withFetch(async () => Response.json({ account: {} }), async () => { await assert.rejects(fetchSearchApiAccount("test-secret"), error => error.code === "provider_invalid_response"); });
});
