import "server-only";
import { randomUUID } from "node:crypto";
import { normalizedName, brandOwnsUrl, competitorWebsite, verificationQuery, contentHash, domainOf, nameInText, objectValue, parsedSourceDate, publicSourceUrl, textValue, verifiedOfficialHit, type CandidateInput, type SearchHit } from "@/brand/competition";
import { instagramUsernameFromUrl, normalizeSearchApiParams, type SearchApiPayload, type ResearchEvidence } from "@/brand/research-normalize";
import { callSearchApi, fetchSearchApiAccount, SearchApiError } from "@/lib/providers/searchapi";
import { excludeOwnBrand, prepareDiscoveryRequest, type DiscoveredCompetitor, invokeResearchOpenAI, prepareCandidateRequest, prepareFallbackRequest, prepareSummaryRequest, validateResearchCandidates, validateResearchSummary, type PreparedResearchRequest } from "@/lib/providers/research-openai";
import { ProviderError } from "@/lib/providers/runtime";
import { researchDb, searchApiKey, researchConfigurationError } from "./db";
import { terminalTask, type ResearchScan, type ResearchTask, type ResearchCompetitor, type ResearchObservation } from "./types";
import { officialSocialLinks } from "./official-links";

const db = () => researchDb();
const now = () => new Date().toISOString();
function stableId(value: string) {
  const h = contentHash(value); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
async function checked<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await request;
  if (result.error) throw new Error("research_persistence_failed");
  return result.data;
}
async function tasksFor(scan: ResearchScan) {
  return await checked(db().from("brand_research_tasks").select("*").eq("scan_id", scan.id).eq("company_id", scan.company_id).order("created_at")) as ResearchTask[];
}
async function competitorsFor(scan: ResearchScan) {
  return await checked(db().from("brand_competitors").select("*").eq("scan_id", scan.id).eq("company_id", scan.company_id).order("created_at")) as ResearchCompetitor[];
}
async function observationsFor(scan: ResearchScan) {
  return await checked(db().from("brand_competitor_observations").select("*").eq("scan_id", scan.id).eq("company_id", scan.company_id).order("created_at")) as ResearchObservation[];
}
async function addTask(scan: ResearchScan, kind: string, key: string, payload: Record<string, unknown>, dependencies: string[] = [], status = "queued") {
  const id = stableId(`${scan.id}:task:${key}`);
  await checked(db().from("brand_research_tasks").upsert({ id, scan_id: scan.id, company_id: scan.company_id, campaign_id: scan.campaign_id, kind, dedupe_key: key, payload, dependencies, status, deadline_at: scan.deadline_at }, { onConflict: "scan_id,dedupe_key", ignoreDuplicates: true }));
  return id;
}
async function setStage(scan: ResearchScan, stage: string) {
  if (scan.stage === stage) return;
  await checked(db().from("brand_competitor_scans").update({ stage }).eq("id", scan.id).in("status", ["queued", "running"]));
}
const payloadOf = (task: ResearchTask): SearchApiPayload | null => task.result?.response && Array.isArray(objectValue(task.result.response).hits) ? task.result.response as SearchApiPayload : null;

/** Reconstruct the next tasks from persisted results; crashes cannot produce duplicate searches. */
async function advance(scan: ResearchScan) {
  if (scan.payload.flow === "on_demand_v2") return advanceOnDemand(scan);
  let tasks = await tasksFor(scan);
  const known = new Set(tasks.map(task => task.dedupe_key));
  async function ensureTask(kind: string, key: string, payload: Record<string, unknown>, dependencies: string[] = [], status = "queued") {
    if (known.has(key)) return;
    await addTask(scan, kind, key, payload, dependencies, status);
    known.add(key);
  }
  if (scan.cache_from_scan_id) {
    await ensureTask("clone", "clone", { source_scan_id: scan.cache_from_scan_id }); return;
  }
  if (!tasks.length) {
    const input = objectValue(scan.payload);
    const brand = textValue(input.brand, 100); const product = textValue(input.product, 220);
    await ensureTask("discovery", "discovery:1", { params: { engine: "google", q: `${brand} ${product} competitors alternatives India` } });
    return;
  }
  // Only a confirmed temporary provider failure can lead to a separately budgeted web fallback.
  // Budget/credential/uncertain-outcome failures never trigger another provider's spending.
  for (const task of tasks.filter(t => t.status === "failed" && t.error_code === "provider_unavailable" && ["discovery", "verify", "products"].includes(t.kind)).slice(0, 2)) {
    if (!tasks.some(t => t.dedupe_key === `fallback:${task.id}`)) await ensureTask("fallback", `fallback:${task.id}`, { source_task_id: task.id, source_kind: task.kind, ...task.payload }, [task.id]);
  }
  tasks = await tasksFor(scan);
  const discovery = tasks.filter(t => t.kind === "discovery" || t.kind === "fallback" && t.payload.source_kind === "discovery");
  if (!discovery.length || discovery.some(t => !terminalTask(t.status))) { await setStage(scan, "discovery"); return; }
  const extract = tasks.find(t => t.dedupe_key === "extract:expanded") ?? tasks.find(t => t.kind === "extract");
  if (!extract) { await ensureTask("extract", "extract", {}, discovery.map(t => t.id)); await setStage(scan, "verification"); return; }
  if (!terminalTask(extract.status)) return;
  const candidates = (Array.isArray(extract.result.candidates) ? extract.result.candidates : []) as CandidateInput[];
  // Buy a second discovery search only if the first did not supply five candidates.
  if (extract.status === "succeeded" && discovery.some(t => t.status === "succeeded") && candidates.length < 5 && !tasks.some(t => t.dedupe_key === "discovery:2")) {
    await ensureTask("discovery", "discovery:2", { params: { engine: "google", q: `${textValue(scan.payload.product, 220)} brands similar to ${textValue(scan.payload.brand, 100)} India` } });
    return;
  }
  if (tasks.some(t => t.dedupe_key === "discovery:2") && extract.dedupe_key !== "extract:expanded") {
    await ensureTask("extract", "extract:expanded", {}, discovery.map(t => t.id)); return;
  }
  for (const candidate of candidates.slice(0, 5)) {
    const prior = discovery.find(t => verifiedOfficialHit(candidate, payloadOf(t)?.hits ?? []));
    await ensureTask("verify", `verify:${candidate.official_domain}`, { candidate, params: { engine: "google", q: verificationQuery(candidate) }, ...(prior ? { reuse_response: payloadOf(prior), reuse_observed_at: prior.result.observed_at } : {}) }, [extract.id]);
  }
  tasks = await tasksFor(scan);
  const verification = tasks.filter(t => t.kind === "verify" || t.kind === "fallback" && t.payload.source_kind === "verify");
  if (verification.some(t => !terminalTask(t.status))) { await setStage(scan, "verification"); return; }
  const competitors = await competitorsFor(scan);
  if (competitors.length < 3) {
    await checked(db().from("brand_competitor_scans").update({ status: "succeeded", stage: "complete", result_count: competitors.length, error_code: "insufficient_verified_competitors", completed_at: now(), cache_expires_at: new Date(Date.now() + 86400000).toISOString() }).eq("id", scan.id).in("status", ["queued", "running"]));
    await checked(db().from("brand_campaigns").update({ status: "planning", updated_at: now() }).eq("id", scan.campaign_id).eq("company_id", scan.company_id).in("status", ["draft", "scanning", "planning"]));
    return;
  }
  for (const competitor of competitors) {
    const verificationTask = verification.find(t => objectValue(t.payload.candidate).official_domain === competitor.official_domain && t.status === "succeeded");
    const response = verificationTask ? payloadOf(verificationTask) : null;
    const officialLinks = Array.isArray(verificationTask?.result.social_links) ? verificationTask.result.social_links : [];
    const handle = officialLinks.map(instagramUsernameFromUrl).find(Boolean) ?? response?.hits.filter(hit => nameInText(competitor.name, `${hit.title} ${hit.snippet}`)).map(hit => instagramUsernameFromUrl(hit.url)).find(Boolean) ?? null;
    const base = { competitor_id: competitor.id };
    const dependencies = verificationTask ? [verificationTask.id] : [];
    await ensureTask("meta_ads", `meta:${competitor.id}`, { ...base, params: { engine: "meta_ad_library", q: competitor.name, country: "IN" } }, dependencies);
    const website = competitorWebsite(competitor);
    const sharedParent = new URL(website).pathname !== "/";
    await ensureTask("google_ads", `google:${competitor.id}`, { ...base, params: { engine: "google_ads_transparency_center", domain: domainOf(website)!, time_period: "last_30_days" }, unavailable_reason: sharedParent ? "shared_parent_domain" : null }, dependencies, sharedParent ? "skipped" : "queued");
    await ensureTask("products", `products:${competitor.id}`, { ...base, params: { engine: "google", q: `site:${website.replace(/^https:\/\/(www\.)?/, "")} ${competitor.name} ${textValue(scan.payload.product, 180).replace(/^our\s+/i, "")} product price India` } }, dependencies);
    await ensureTask("instagram_profile", `profile:${competitor.id}`, { ...base, official_social_links: officialLinks, params: handle ? { engine: "instagram_profile", username: handle } : {}, unavailable_reason: handle ? null : "profile_not_found" }, dependencies, handle ? "queued" : "skipped");
  }
  tasks = await tasksFor(scan);
  for (const profile of tasks.filter(t => t.kind === "instagram_profile" && terminalTask(t.status))) {
    const postId = profile.status === "succeeded" ? textValue(profile.result.post_id, 100) : "";
    await ensureTask("instagram_comments", `comments:${profile.payload.competitor_id}`, { competitor_id: profile.payload.competitor_id, params: postId ? { engine: "instagram_comments", post_id: postId } : {}, unavailable_reason: postId ? null : "comments_not_available" }, [profile.id], postId ? "queued" : "skipped");
  }
  tasks = await tasksFor(scan);
  const evidence = tasks.filter(t => ["meta_ads", "google_ads", "products", "instagram_profile", "instagram_comments"].includes(t.kind) || t.kind === "fallback" && t.payload.source_kind === "products");
  if (evidence.some(t => !terminalTask(t.status))) { await setStage(scan, "evidence"); return; }
  const summary = tasks.find(t => t.kind === "summarize");
  if (!summary) { await ensureTask("summarize", "summarize", {}, tasks.map(t => t.id)); await setStage(scan, "report"); return; }
  if (!terminalTask(summary.status)) return;
  const latestCompetitors = await competitorsFor(scan);
  const partial = tasks.some(t => ["failed", "skipped", "uncertain"].includes(t.status)) || latestCompetitors.some(c => c.research_status !== "complete");
  const failed = !competitors.length && tasks.some(t => ["discovery", "extract", "verify"].includes(t.kind) && ["failed", "uncertain"].includes(t.status));
  await checked(db().from("brand_competitor_scans").update({ status: failed ? "failed" : "succeeded", stage: "complete", result_count: competitors.length, error_code: failed ? "research_incomplete" : partial ? "partial_evidence" : null, completed_at: now(), cache_expires_at: new Date(Date.now() + 86400000).toISOString() }).eq("id", scan.id).in("status", ["queued", "running"]));
  await checked(db().from("brand_campaigns").update({ status: "planning", updated_at: now() }).eq("id", scan.campaign_id).eq("company_id", scan.company_id).in("status", ["draft", "scanning", "planning"]));
}

async function saveEvidence(scan: ResearchScan, rows: Array<{ kind: string; title: string; url: string; text: string; sourceDate: string | null; attributes: Record<string, unknown> }>, observedAt: string, searchId: string | null, competitor?: ResearchCompetitor) {
  const records = rows.flatMap(item => {
    const url = publicSourceUrl(item.url); if (!url) return [];
    const key = `${scan.payload.flow === "on_demand_v2" ? (competitor?.id ?? "discovery") + ":" : ""}${item.kind}:${contentHash(JSON.stringify([url, item.attributes.commentId ?? null, item.text]))}`;
    return [{ id: stableId(`${scan.id}:evidence:${key}`), company_id: scan.company_id, scan_id: scan.id, competitor_id: competitor?.id ?? null, competitor_name: competitor?.name ?? "Discovery source", competitor_domain: competitor?.official_domain ?? null, evidence_kind: item.kind, source_record_key: key, source_url: url, source_domain: domainOf(url)!, source_title: item.title.slice(0, 300), source_snippet: item.text.slice(0, 1800), source_date_text: item.sourceDate, published_at: parsedSourceDate(item.sourceDate), observed_at: observedAt, provider_search_id: searchId, content_hash: contentHash(JSON.stringify([url, item.text, item.sourceDate])), attributes: item.attributes }];
  });
  if (records.length) await checked(db().from("brand_competitor_observations").upsert(records, { onConflict: "scan_id,source_record_key", ignoreDuplicates: true }));
  return records;
}
function hitEvidence(hit: SearchHit, kind: string) {
  return { kind, title: hit.title, url: hit.url, text: hit.snippet, sourceDate: hit.sourceDate, attributes: { coverage: "Indexed search excerpt; not a complete page" } as Record<string, unknown> };
}
function belongsToBrand(evidence: ResearchEvidence, competitor: ResearchCompetitor) {
  const target = textValue(evidence.attributes.targetDomain);
  const landing = Array.isArray(evidence.attributes.landingUrls) ? evidence.attributes.landingUrls : [];
  const urls = [...landing, ...(target ? [`https://${target}/`] : [])];
  // A same-name advertiser alone is not sufficient evidence of ownership.
  return urls.some(url => brandOwnsUrl(competitor, url));
}
async function processSearchResult(scan: ResearchScan, task: ResearchTask, response: SearchApiPayload, observedAt: string, readLinks = true) {
  if (task.kind.startsWith("detail_")) return processDetailResult(scan, task, response, observedAt);
  const kind = task.kind === "fallback" ? textValue(task.payload.source_kind) : task.kind;
  const competitor = task.payload.competitor_id ? (await competitorsFor(scan)).find(c => c.id === task.payload.competitor_id) : undefined;
  if (kind === "discovery") await saveEvidence(scan, response.hits.map(hit => hitEvidence(hit, task.kind === "fallback" ? "web_fallback" : "discovery")), observedAt, response.searchId);
  if (kind === "verify") {
    const candidate = task.payload.candidate as CandidateInput;
    const hit = verifiedOfficialHit(candidate, response.hits);
    if (!hit) return { verified: false };
    const id = stableId(`${scan.id}:competitor:${candidate.official_domain}`);
    await checked(db().from("brand_competitors").upsert({ id, company_id: scan.company_id, campaign_id: scan.campaign_id, scan_id: scan.id, name: candidate.name, official_domain: candidate.official_domain, rationale: candidate.rationale, status: "candidate", evidence_ids: candidate.evidence_ids, verified_at: observedAt, research_status: "pending", research_summary: {} }, { onConflict: "scan_id,official_domain", ignoreDuplicates: true }));
    const record = (await competitorsFor(scan)).find(c => c.id === id)!;
    const pageLinks = readLinks ? await officialSocialLinks(hit.url) : Array.isArray(task.result.social_links) ? task.result.social_links : [];
    // Parent-company pages can link to a corporate account in their footer.
    // Only use an Instagram profile whose handle also identifies this brand.
    const brandName = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const socialLinks = pageLinks.filter(link => {
      const handle = instagramUsernameFromUrl(link)?.toLowerCase().replace(/[^a-z0-9]/g, "");
      return brandName.length > 1 && handle?.includes(brandName);
    });
    const officialHit = hitEvidence(hit, "official_site");
    officialHit.attributes.social_links = socialLinks;
    if (task.kind === "fallback") { officialHit.text = ""; officialHit.attributes.coverage = "Official URL cited by web search; generated summary retained separately"; await saveEvidence(scan, [hitEvidence(hit, "web_fallback")], observedAt, response.searchId, record); }
    const official = await saveEvidence(scan, [officialHit], observedAt, response.searchId, record);
    await checked(db().from("brand_competitors").update({ evidence_ids: [...new Set([...candidate.evidence_ids, ...official.map(row => row.id)])] }).eq("id", id));
    return { verified: true, competitor_id: id, social_links: socialLinks };
  }
  if (!competitor) return {};
  if (kind === "products") await saveEvidence(scan, response.hits.filter(hit => brandOwnsUrl(competitor, hit.url)).map(hit => hitEvidence(hit, task.kind === "fallback" ? "web_fallback" : "product_price")), observedAt, response.searchId, competitor);
  if (["meta_ads", "google_ads"].includes(kind)) await saveEvidence(scan, response.evidence.filter(row => belongsToBrand(row, competitor)), observedAt, response.searchId, competitor);
  if (kind === "instagram_profile") {
    const handle = textValue(objectValue(task.payload.params).username);
    if (!handle || response.instagramUsername?.toLowerCase() !== handle.toLowerCase()) return { profile_verified: false, post_id: null };
    const officialLinks = Array.isArray(task.payload.official_social_links) ? task.payload.official_social_links : [];
    const linkedFromOfficial = officialLinks.some(link => instagramUsernameFromUrl(link)?.toLowerCase() === handle.toLowerCase());
    if (!brandOwnsUrl(competitor, response.profileWebsite) && !linkedFromOfficial) return { profile_verified: false, post_id: null };
    await saveEvidence(scan, response.evidence, observedAt, response.searchId, competitor);
    return { profile_verified: true, post_id: response.postId };
  }
  if (kind === "instagram_comments") {
    const postId = textValue(objectValue(task.payload.params).post_id);
    if (response.postId !== postId) return { post_verified: false };
    await saveEvidence(scan, response.evidence.filter(row => row.kind === "social_comment" && row.attributes.postId === postId), observedAt, response.searchId, competitor);
  }
  return {};
}

async function finishTask(task: ResearchTask, status: string, result: Record<string, unknown> = {}, error: string | null = null, retryAt: string | null = null) {
  await checked(db().rpc("finish_research_task", { task_id: task.id, lease: task.lease_token, task_status: status, task_result: { ...task.result, ...result }, failure_code: error, retry_at: retryAt }));
}
async function checkpoint(task: ResearchTask, result: Record<string, unknown>) {
  const rows = await checked(db().from("brand_research_tasks").update({ result: { ...task.result, ...result } }).eq("id", task.id).eq("lease_token", task.lease_token).eq("status", "running").select("id"));
  if (!rows?.length) throw new Error("research_lease_lost");
  task.result = { ...task.result, ...result };
}
async function reserve(task: ResearchTask, provider: "searchapi" | "openai", cost = 0, input = 0, output = 0) {
  const request = () => checked(db().rpc("reserve_research_attempt", { task_id: task.id, lease: task.lease_token, provider, estimated_usd: cost, input_tokens: input, output_tokens: output }));
  let result = objectValue(await request());
  // A short pacing pause is not a provider failure. Keep this lease instead of
  // sending the task back through another scheduler tick. No paid attempt yet.
  const pacingMs = Math.max(1, Number(result.retry_after) || 1) * 1000;
  if (!result.allowed && result.error === "provider_pacing" && pacingMs <= 3000) {
    await new Promise(resolve => setTimeout(resolve, pacingMs));
    result = objectValue(await request());
  }
  if (!result.allowed || typeof result.attempt_id !== "string") {
    const code = textValue(result.error) || "research_budget_blocked";
    const retry = ["provider_concurrency", "provider_pacing", "provider_rate_limited", "provider_account_stale", "provider_hourly_limit"].includes(code);
    // A full two-call slot normally frees in seconds; preserve actual provider
    // rate-limit/backoff durations for all other denials.
    const retrySeconds = code === "provider_concurrency" ? 2 : Math.max(2, Number(result.retry_after) || 60);
    await finishTask(task, retry ? "queued" : "failed", {}, code, retry ? new Date(Date.now() + retrySeconds * 1000).toISOString() : null);
    return null;
  }
  task.attempt_count += 1;
  return result.attempt_id;
}
async function finishAttempt(task: ResearchTask, attemptId: string, status: string, info: Record<string, unknown> = {}) {
  await checked(db().rpc("finish_research_attempt", { attempt_id: attemptId, lease: task.lease_token, outcome: { status, ...info } }));
}
async function cachedSearch(task: ResearchTask, params: Record<string, string>): Promise<{ response: SearchApiPayload; observedAt: string } | null> {
  const cacheKey = contentHash(JSON.stringify(["searchapi-v1", ...Object.entries(normalizeSearchApiParams(params)).sort(([a], [b]) => a.localeCompare(b))]));
  const cache = await checked(db().from("brand_research_cache").select("payload,fetched_at").eq("company_id", task.company_id).eq("cache_key", cacheKey).gt("expires_at", now()).maybeSingle());
  if (!cache || !Array.isArray(objectValue(cache.payload).hits)) return null;
  await checkpoint(task, { response: cache.payload, observed_at: cache.fetched_at, cache_hit: true });
  return { response: cache.payload as SearchApiPayload, observedAt: cache.fetched_at };
}
async function saveSearchCache(task: ResearchTask, params: Record<string, string>, response: SearchApiPayload, observedAt: string) {
  const cacheKey = contentHash(JSON.stringify(["searchapi-v1", ...Object.entries(normalizeSearchApiParams(params)).sort(([a], [b]) => a.localeCompare(b))]));
  await checked(db().from("brand_research_cache").upsert({ company_id: task.company_id, cache_key: cacheKey, payload: response, fetched_at: observedAt, expires_at: new Date(Date.parse(observedAt) + 86400000).toISOString() }, { onConflict: "company_id,cache_key" }));
}
async function searchTask(scan: ResearchScan, task: ResearchTask) {
  const params = normalizeSearchApiParams(objectValue(task.payload.params) as Record<string, string>);
  let response = payloadOf(task);
  let observedAt = textValue(task.result.observed_at) || now();
  // Discovery may already prove this official website. Reuse that paid response.
  const reused = objectValue(task.payload.reuse_response);
  if (!response && Array.isArray(reused.hits)) {
    response = reused as SearchApiPayload;
    observedAt = textValue(task.payload.reuse_observed_at) || observedAt;
    await checkpoint(task, { response, observed_at: observedAt, cache_hit: true });
  }
  if (!response) {
    const cache = await cachedSearch(task, params);
    if (cache) { response = cache.response; observedAt = cache.observedAt; }
  }
  if (!response) {
    if (scan.payload.flow === "on_demand_v2") {
      const configurationError = researchConfigurationError("details");
      if (configurationError) { await finishTask(task, "failed", {}, configurationError); return; }
      // SearchAPI account availability must never block OpenAI discovery.
      const control = await checked(db().from("brand_research_control").select("*").limit(1).single());
      if (!control.account_checked_at || Date.parse(control.account_checked_at) < Date.now() - 5 * 60000) {
        try { await checked(db().rpc("update_research_account", { account_info: await fetchSearchApiAccount(searchApiKey()) })); }
        catch { await finishTask(task, "failed", {}, "account_check_failed"); return; }
      }
    }
    const attemptId = await reserve(task, "searchapi"); if (!attemptId) return;
    const start = Date.now();
    try {
      response = await callSearchApi(params, searchApiKey());
    } catch (cause) { await failPaidTask(task, attemptId, cause, Date.now() - start); return; }
    observedAt = now();
    await checkpoint(task, { response, observed_at: observedAt, attempt_id: attemptId, provider: "searchapi", request_id: response.searchId });
    await finishAttempt(task, attemptId, "success", { latency_ms: Date.now() - start, request_id: response.searchId });
    await saveSearchCache(task, params, response, observedAt);
  } else if (typeof task.result.attempt_id === "string") {
    // Persisted response proves completion even if the invocation died before finalizing the ledger.
    await finishAttempt(task, task.result.attempt_id, "success", { request_id: response.searchId });
  }
  const result = await processSearchResult(scan, task, response, observedAt);
  await finishTask(task, "succeeded", result);
}
async function failPaidTask(task: ResearchTask, attemptId: string, cause: unknown, latency: number) {
  const code = cause instanceof SearchApiError ? cause.code : cause instanceof Error ? cause.message : "provider_request_failed";
  const uncertain = cause instanceof SearchApiError ? cause.uncertain : ["provider_timeout", "submission_unknown", "research_persistence_failed", "research_lease_lost"].includes(code);
  const retryable = !task.kind.startsWith("detail_") && task.kind !== "native_discovery" && !uncertain && task.attempt_count < 2 && ["provider_unavailable", "provider_rate_limited"].includes(code);
  const retrySeconds = Math.max(cause instanceof SearchApiError ? cause.retryAfter ?? 0 : 0, 15 * 2 ** task.attempt_count + Math.floor(Math.random() * 5));
  await finishAttempt(task, attemptId, uncertain ? "uncertain" : "failed", { failure_code: code, latency_ms: latency, retry_after: retrySeconds, ...(cause instanceof SearchApiError && cause.requestId ? { request_id: cause.requestId } : {}) });
  await finishTask(task, uncertain ? "uncertain" : retryable ? "queued" : "failed", {}, code, retryable ? new Date(Date.now() + retrySeconds * 1000).toISOString() : null);
}

/** Re-evaluate purchased responses only. Never calls either provider or queues
 * work. The caller must establish campaign/company authority first. */
export async function recoverSavedResearch(scan: ResearchScan) {
  if (scan.payload.flow === "on_demand_v2" || !["succeeded", "failed"].includes(scan.status)) return;
  const tasks = await tasksFor(scan);
  const observations = await observationsFor(scan);
  const savedHits: SearchHit[] = observations.filter(row => row.evidence_kind === "official_site").map(row => ({ title: row.source_title, url: row.source_url, snippet: row.source_snippet ?? "", sourceDate: null, asin: null, rating: null, reviewCount: null, price: null, priceText: null }));
  for (const task of tasks.filter(t => t.kind === "verify")) {
    const response = payloadOf(task); if (!response) continue;
    const result = await processSearchResult(scan, task, { ...response, hits: [...response.hits, ...savedHits] }, textValue(task.result.observed_at) || scan.completed_at || now(), false);
    await checked(db().from("brand_research_tasks").update({ result: { ...task.result, ...result, rechecked_at: now() } }).eq("id", task.id).eq("scan_id", scan.id));
  }
  for (const task of tasks.filter(t => ["products", "meta_ads", "google_ads", "instagram_profile", "instagram_comments"].includes(t.kind))) {
    const response = payloadOf(task); if (!response) continue;
    const result = await processSearchResult(scan, task, response, textValue(task.result.observed_at) || scan.completed_at || now(), false);
    await checked(db().from("brand_research_tasks").update({ result: { ...task.result, ...result, rechecked_at: now() } }).eq("id", task.id).eq("scan_id", scan.id));
  }
  const competitors = await competitorsFor(scan);
  const evidence = await observationsFor(scan);
  for (const competitor of competitors) {
    const summary = { ...objectValue(competitor.research_summary) };
    const citations = { ...objectValue(summary.field_evidence_ids) };
    const rows = evidence.filter(row => row.competitor_id === competitor.id);
    for (const [field, kinds] of Object.entries({ product_price: ["product_price"], campaign: ["meta_ad", "google_ad"], social: ["social_post"] })) {
      if (summary[field] && summary[field] !== "Insufficient evidence") continue;
      const sources = rows.filter(row => kinds.includes(row.evidence_kind)); if (!sources.length) continue;
      summary[field] = field === "social" ? `${sources.length} saved public posts. Open Posts to review the content.` : field === "campaign" ? `${sources.length} saved advertisements. Open Ads to review the campaigns.` : `${textValue(sources[0].source_title, 180)}. See source for product details; price may be unavailable.`;
      citations[field] = sources.map(row => row.id);
    }
    summary.field_evidence_ids = citations;
    summary.id = competitor.id;
    summary.evidence_ids = [...new Set(Object.values(citations).flatMap(value => Array.isArray(value) ? value : []).filter(id => rows.some(row => row.id === id)))];
    const complete = ["product_price", "campaign", "social", "sentiment"].every(field => summary[field] && summary[field] !== "Insufficient evidence");
    await checked(db().from("brand_competitors").update({ research_summary: summary, research_status: complete ? "complete" : "partial" }).eq("id", competitor.id).eq("scan_id", scan.id));
  }
  await checked(db().from("brand_competitor_scans").update({ result_count: competitors.length }).eq("id", scan.id).eq("company_id", scan.company_id));
  return { competitors: competitors.length, searchRequests: 0 };
}

async function cloneTask(scan: ResearchScan, task: ResearchTask) {
  const source = await checked(db().from("brand_competitor_scans").select("*").eq("id", task.payload.source_scan_id).eq("company_id", scan.company_id).maybeSingle()) as ResearchScan | null;
  if (!source) { await finishTask(task, "failed", {}, "cache_source_missing"); return; }
  if (["queued", "running"].includes(source.status)) { await finishTask(task, "queued", {}, null, new Date(Date.now() + 15000).toISOString()); return; }
  const competitors = await competitorsFor(source);
  const observations = await observationsFor(source);
  const ids = new Map<string, string>();
  for (const row of [...competitors, ...observations]) ids.set(row.id, stableId(`${scan.id}:clone:${row.id}`));
  const remap = (value: unknown): unknown => typeof value === "string" ? ids.get(value) ?? value : Array.isArray(value) ? value.map(remap) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remap(item)])) : value;
  for (const competitor of competitors) await checked(db().from("brand_competitors").upsert({ ...competitor, id: ids.get(competitor.id), campaign_id: scan.campaign_id, scan_id: scan.id, status: "candidate", confirmed_at: null, evidence_ids: competitor.evidence_ids.map(id => ids.get(id) ?? id), research_summary: remap(competitor.research_summary), created_at: now(), updated_at: now() }, { onConflict: "scan_id,official_domain", ignoreDuplicates: true }));
  if (observations.length) await checked(db().from("brand_competitor_observations").upsert(observations.map(row => ({ ...row, id: ids.get(row.id), scan_id: scan.id, competitor_id: row.competitor_id ? ids.get(row.competitor_id) : null, created_at: now() })), { onConflict: "scan_id,source_record_key", ignoreDuplicates: true }));
  await finishTask(task, "succeeded", { cache_hit: true, source_scan_id: source.id });
  await checked(db().from("brand_competitor_scans").update({ status: source.status === "succeeded" ? "succeeded" : "failed", stage: "complete", result_count: competitors.length, completed_at: source.completed_at ?? now(), error_code: source.error_code, cache_hits: 1, cache_expires_at: source.cache_expires_at }).eq("id", scan.id));
  await checked(db().from("brand_campaigns").update({ status: "planning", updated_at: now() }).eq("id", scan.campaign_id).eq("company_id", scan.company_id).in("status", ["draft", "scanning", "planning"]));
}

async function aiTask(scan: ResearchScan, task: ResearchTask) {
  const observations = await observationsFor(scan);
  const competitors = await competitorsFor(scan);
  const input = objectValue(scan.payload);
  const sources = observations.filter(row => !row.competitor_id && ["discovery", "web_fallback"].includes(row.evidence_kind));
  if (task.kind === "extract" && !sources.length) { await finishTask(task, "succeeded", { candidates: [] }); return; }
  if (task.kind === "summarize" && !competitors.length) { await finishTask(task, "succeeded", { summaries: [] }); return; }
  let prepared: PreparedResearchRequest;
  try {
    prepared = task.kind === "extract"
      ? prepareCandidateRequest(textValue(input.brand), textValue(input.product), typeof input.ownDomain === "string" ? input.ownDomain : null, sources)
      : task.kind === "summarize" ? prepareSummaryRequest(competitors, observations)
      : prepareFallbackRequest(textValue(objectValue(task.payload.params).q, 800) || `${textValue(input.product)} competing brands India`);
  } catch (error) { await finishTask(task, "failed", {}, error instanceof ProviderError ? error.code : "provider_not_configured"); return; }
  let value: unknown = task.result.ai_value;
  if (value === undefined) {
    const attemptId = await reserve(task, "openai", prepared.estimatedCostUsd, prepared.reservedInputTokens, prepared.outputTokens);
    if (!attemptId) return;
    const start = Date.now();
    let response;
    try { response = await invokeResearchOpenAI(prepared, process.env.OPENAI_API_KEY ?? ""); }
    catch (cause) { await failPaidTask(task, attemptId, cause, Date.now() - start); return; }
    // Only validated, bounded values are persisted. Unknown IDs and fabricated source links are discarded.
    value = task.kind === "extract" ? validateResearchCandidates(response.value, sources, textValue(input.brand), typeof input.ownDomain === "string" ? input.ownDomain : null)
      : task.kind === "summarize" ? validateResearchSummary(response.value, competitors, observations) : response.value;
    await checkpoint(task, { ai_value: value, observed_at: now(), attempt_id: attemptId, provider: "openai", request_id: response.requestId });
    await finishAttempt(task, attemptId, "success", { latency_ms: Date.now() - start, request_id: response.requestId, input_tokens: response.inputTokens, output_tokens: response.outputTokens });
  } else if (typeof task.result.attempt_id === "string") await finishAttempt(task, task.result.attempt_id, "success", { request_id: task.result.request_id });
  if (task.kind === "extract") { await finishTask(task, "succeeded", { candidates: Array.isArray(value) ? value : [] }); return; }
  if (task.kind === "summarize") {
    const summaries = objectValue(value).competitors;
    for (const entry of Array.isArray(summaries) ? summaries : []) {
      const summary = objectValue(entry);
      if (!competitors.some(row => row.id === summary.id)) continue;
      const sufficient = ["product_price", "campaign", "social", "sentiment"].every(field => summary[field] && summary[field] !== "Insufficient evidence");
      await checked(db().from("brand_competitors").update({ research_summary: summary, research_status: sufficient ? "complete" : "partial", enriched_at: now() }).eq("id", summary.id).eq("scan_id", scan.id));
    }
    await finishTask(task, "succeeded", { summaries }); return;
  }
  const list = objectValue(value).sources;
  const hits: SearchHit[] = (Array.isArray(list) ? list : []).slice(0, 10).flatMap(item => {
    const row = objectValue(item); const url = publicSourceUrl(row.url); if (!url) return [];
    return [{ title: textValue(row.title, 300), url, snippet: textValue(row.text, 1200), sourceDate: null, asin: null, rating: null, reviewCount: null, price: null, priceText: null }];
  });
  const normalized: SearchApiPayload = { searchId: textValue(task.result.request_id) || null, hits, evidence: [], instagramUsername: null, profileWebsite: null, postId: null };
  await checkpoint(task, { response: normalized });
  const result = await processSearchResult(scan, task, normalized, textValue(task.result.observed_at) || now());
  await finishTask(task, "succeeded", result);
}

async function runTask(task: ResearchTask) {
  const scan = await checked(db().from("brand_competitor_scans").select("*").eq("id", task.scan_id).eq("company_id", task.company_id).maybeSingle()) as ResearchScan | null;
  if (!scan || !["queued", "running"].includes(scan.status)) { await finishTask(task, "skipped", {}, "scan_finished"); return; }
  if (task.kind === "native_discovery") await discoveryTask(scan, task);
  else if (task.kind === "clone") await cloneTask(scan, task);
  else if (["extract", "summarize", "fallback"].includes(task.kind)) await aiTask(scan, task);
  else await searchTask(scan, task);
  // Publish the completed report immediately, even if this invocation's drain budget is spent.
  if (task.kind === "summarize" || scan.payload.flow === "on_demand_v2") await advance(scan);
}

/** One short invocation drains independent tasks. PostgreSQL owns cross-worker pacing and all caps. */
export async function runResearchWorker() {
  const workerId = randomUUID();
  const start = Date.now();
  const control = await checked(db().from("brand_research_control").select("*").limit(1).single());
  if (!control.enabled) return { processed: 0, error: "provider_disabled" };
  const legacy = await checked(db().from("brand_competitor_scans").select("payload").eq("provider_key", "searchapi").in("status", ["queued", "running"]));
  // Account endpoints are measured separately; they do not consume a scan's search-attempt allowance.
  if ((legacy ?? []).some(row => objectValue(row.payload).flow !== "on_demand_v2") && (!control.account_checked_at || Date.parse(control.account_checked_at) < Date.now() - 5 * 60000)) {
    try {
      const account = await fetchSearchApiAccount(searchApiKey());
      await checked(db().rpc("update_research_account", { account_info: account }));
    } catch (error) {
      const code = error instanceof SearchApiError ? error.code : "account_check_failed";
      await checked(db().from("brand_research_control").update({ last_error: code, worker_heartbeat_at: now() }).eq("id", control.id));
      return { processed: 0, error: code };
    }
  }
  await checked(db().from("brand_research_control").update({ worker_heartbeat_at: now(), last_error: null }).eq("id", control.id));
  let processed = 0;
  while (Date.now() - start < 25000) {
    const scans = await checked(db().from("brand_competitor_scans").select("*").eq("provider_key", "searchapi").in("status", ["queued", "running"]).order("created_at").limit(30)) as ResearchScan[];
    for (const scan of scans) {
      if (Date.now() - start >= 25000) break;
      await advance(scan);
    }
    if (Date.now() - start >= 25000) break;
    const tasks: ResearchTask[] = [];
    for (let i = 0; i < 2; i++) {
      const data = await checked(db().rpc("claim_research_task", { worker_id: workerId }));
      const task = (Array.isArray(data) ? data[0] : data) as ResearchTask | null;
      if (task?.id) tasks.push(task);
    }
    if (!tasks.length) {
      const pending = await checked(db().from("brand_research_tasks").select("next_attempt_at").eq("status", "queued").gt("next_attempt_at", now()).order("next_attempt_at").limit(1).maybeSingle());
      const waitMs = pending ? Math.max(200, Date.parse(pending.next_attempt_at) - Date.now()) : 0;
      if (waitMs > 0 && waitMs <= 3000 && Date.now() - start + waitMs < 25000) { await new Promise(resolve => setTimeout(resolve, waitMs)); continue; }
      break;
    }
    await Promise.all(tasks.map(async task => {
      try { await runTask(task); processed++; }
      catch { console.error("[brand-research] Task checkpoint interrupted", { taskId: task.id }); }
    }));
  }
  return { processed };
}


// V2: discovery stops at cards; only the authorized Get RPC creates detail tasks.
async function discoveryTask(scan: ResearchScan, task: ResearchTask) {
  const error = researchConfigurationError("discovery");
  if (error) { await finishTask(task, "failed", {}, error); return; }
  let value = task.result.ai_value;
  if (value === undefined) {
    const request = prepareDiscoveryRequest(textValue(scan.payload.brand), textValue(scan.payload.product), textValue(scan.payload.ownDomain) || null);
    const attempt = await reserve(task, "openai", request.estimatedCostUsd, request.reservedInputTokens, request.outputTokens);
    if (!attempt) return;
    const start = Date.now();
    let response;
    try { response = await invokeResearchOpenAI(request, process.env.OPENAI_API_KEY ?? ""); }
    catch (cause) { await failPaidTask(task, attempt, cause, Date.now() - start); return; }
    value = response.value;
    await checkpoint(task, { ai_value: value, observed_at: now(), attempt_id: attempt, request_id: response.requestId });
    await finishAttempt(task, attempt, "success", { request_id: response.requestId, latency_ms: Date.now() - start, input_tokens: response.inputTokens, output_tokens: response.outputTokens });
  } else if (typeof task.result.attempt_id === "string") await finishAttempt(task, task.result.attempt_id, "success", { request_id: task.result.request_id });
  const list = objectValue(value).competitors;
  const candidates = excludeOwnBrand((Array.isArray(list) ? list : []) as DiscoveredCompetitor[], textValue(scan.payload.brand), textValue(scan.payload.ownDomain) || null);
  const observedAt = textValue(task.result.observed_at) || now();
  for (const candidate of candidates.slice(0, 5)) {
    const id = stableId(`${scan.id}:competitor:${candidate.official_domain}`);
    // Persist the card before optional public-page reads. Social handles never gate discovery.
    await checked(db().from("brand_competitors").upsert({ id, company_id: scan.company_id, campaign_id: scan.campaign_id, scan_id: scan.id, name: candidate.name, official_domain: candidate.official_domain, rationale: candidate.rationale, status: "candidate", evidence_ids: [], verified_at: observedAt,
      research_status: "not_fetched", research_summary: { website: candidate.website, social_links: candidate.social_links, discovery_provider: "openai_web_search" } }, { onConflict: "scan_id,official_domain", ignoreDuplicates: true }));
    const competitor = (await competitorsFor(scan)).find(row => row.id === id)!;
    const rows = await saveEvidence(scan, candidate.source_urls.map(url => ({ kind: url === candidate.website ? "official_site" : "discovery", title: candidate.name, url, text: candidate.rationale, sourceDate: null,
      attributes: { coverage: "Relevance summarized by OpenAI native web search; URL grounded in retrieved sources" } })), observedAt, textValue(task.result.request_id) || null, competitor);
    await checked(db().from("brand_competitors").update({ evidence_ids: rows.map(row => row.id) }).eq("id", id));
  }
  // At most five bounded, free public HTML reads. No SearchAPI lookup for handles.
  await Promise.all(candidates.slice(0, 5).map(async candidate => {
    const links = await officialSocialLinks(candidate.website);
    const id = stableId(`${scan.id}:competitor:${candidate.official_domain}`);
    await checked(db().from("brand_competitors").update({ research_summary: { website: candidate.website, social_links: [...new Set([...candidate.social_links, ...links])].slice(0, 12), discovery_provider: "openai_web_search" } }).eq("id", id).eq("research_status", "not_fetched"));
  }));
  await finishTask(task, "succeeded", { competitor_count: candidates.length });
}

function socialLinks(competitor: ResearchCompetitor): string[] {
  const links = objectValue(competitor.research_summary).social_links;
  return (Array.isArray(links) ? links : []).map(publicSourceUrl).filter((url): url is string => !!url);
}
function facebookLink(competitor: ResearchCompetitor) {
  return socialLinks(competitor).find(url => /^(www\.)?facebook\.com$/.test(new URL(url).hostname) && !/^\/(?:sharer|share|dialog|plugins|login|watch|reel|ads)(?:\/|\.|$)/.test(new URL(url).pathname));
}
function sameFacebookPage(url: string, id: string, links: string[]) {
  return links.some(link => {
    const a = new URL(link); const b = new URL(url);
    if (!/^(www\.)?facebook\.com$/.test(a.hostname)) return false;
    return a.searchParams.get("id") === id || a.pathname.replace(/\/$/, "").toLowerCase() === b.pathname.replace(/\/$/, "").toLowerCase();
  });
}
async function processDetailResult(scan: ResearchScan, task: ResearchTask, response: SearchApiPayload, observedAt: string) {
  const competitor = (await competitorsFor(scan)).find(row => row.id === task.payload.competitor_id);
  if (!competitor) return {};
  if (task.kind === "detail_page_lookup") {
    const candidates = (response.pages ?? []).filter(row => normalizedName(row.name) === normalizedName(competitor.name) && (!row.country || ["IN", "India"].includes(row.country)));
    // One identity check only, never fan out across same-name pages.
    return { page_id: candidates.length === 1 ? candidates[0].id : null };
  }
  if (task.kind === "detail_facebook") {
    const page = response.facebookPage;
    const expectedId = textValue(objectValue(task.payload.params).page_id);
    const verified = !!page && (!expectedId || page.id === expectedId) && (brandOwnsUrl(competitor, page.website) || sameFacebookPage(page.url, page.id, socialLinks(competitor)));
    if (!verified || !page) return { page_verified: false };
    await saveEvidence(scan, response.evidence, observedAt, response.searchId, competitor);
    const links = [...new Set([...socialLinks(competitor), page.url, ...(page.instagram ? [`https://www.instagram.com/${page.instagram}/`] : [])])];
    await checked(db().from("brand_competitors").update({ research_summary: { ...objectValue(competitor.research_summary), social_links: links } }).eq("id", competitor.id));
    return { page_verified: true, page_id: page.id };
  }
  let rows: ResearchEvidence[] = [];
  if (task.kind === "detail_products") {
    await saveEvidence(scan, response.hits.filter(hit => brandOwnsUrl(competitor, hit.url)).map(hit => hitEvidence(hit, "product_price")), observedAt, response.searchId, competitor);
  } else if (task.kind === "detail_meta") {
    const id = textValue(objectValue(task.payload.params).page_id);
    rows = response.evidence.filter(row => row.attributes.advertiserId === id || belongsToBrand(row, competitor));
  } else if (task.kind === "detail_reviews") rows = response.evidence.filter(row => row.kind === "facebook_review" && row.attributes.pageId === objectValue(task.payload.params).page_id);
  else if (task.kind === "detail_linkedin") rows = response.evidence.filter(row => normalizedName(textValue(row.attributes.advertiser)) === normalizedName(competitor.name));
  else if (task.kind === "detail_reddit") rows = response.evidence.filter(row => belongsToBrand(row, competitor));
  if (rows.length) await saveEvidence(scan, rows, observedAt, response.searchId, competitor);
  return { saved_count: rows.length };
}

async function advanceOnDemand(scan: ResearchScan) {
  let tasks = await tasksFor(scan);
  const known = new Set(tasks.map(row => row.dedupe_key));
  const ensure = async (kind: string, competitor: ResearchCompetitor, params: Record<string, string>, dependencies: string[] = [], skip = false) => {
    const key = `${kind}:${competitor.id}`;
    if (!known.has(key)) { await addTask(scan, kind, key, { competitor_id: competitor.id, params }, dependencies, skip ? "skipped" : "queued"); known.add(key); }
  };
  if (scan.cache_from_scan_id && !tasks.some(row => row.kind === "clone" && terminalTask(row.status))) {
    if (!tasks.some(row => row.kind === "clone")) await addTask(scan, "clone", "clone", { source_scan_id: scan.cache_from_scan_id });
    return;
  }
  if (!scan.cache_from_scan_id) {
    const discovery = tasks.find(row => row.kind === "native_discovery");
    if (!discovery) { await addTask(scan, "native_discovery", "native_discovery", {}); await setStage(scan, "discovery"); return; }
    if (!terminalTask(discovery.status)) { await setStage(scan, "discovery"); return; }
  }
  const competitors = await competitorsFor(scan);
  for (const competitor of competitors.filter(row => row.research_status === "loading")) {
    const related = tasks.filter(row => row.payload.competitor_id === competitor.id);
    // Only the service-only Get RPC is allowed to insert the initial detail task.
    if (!related.some(row => row.kind === "detail_products")) continue;
    const fb = facebookLink(competitor);
    if (fb) await ensure("detail_facebook", competitor, { engine: "facebook_business_page", url: fb });
    else {
      await ensure("detail_page_lookup", competitor, { engine: "meta_ad_library_page_search", q: competitor.name });
      const lookup = related.find(row => row.kind === "detail_page_lookup");
      if (lookup && terminalTask(lookup.status)) {
        const pageId = textValue(lookup.result.page_id);
        await ensure("detail_facebook", competitor, pageId ? { engine: "facebook_business_page", page_id: pageId } : {}, [lookup.id], !pageId);
      }
    }
    const profile = related.find(row => row.kind === "detail_facebook");
    if (profile && terminalTask(profile.status)) {
      const pageId = profile.result.page_verified ? textValue(profile.result.page_id) : "";
      await ensure("detail_reviews", competitor, pageId ? { engine: "facebook_business_page_reviews", page_id: pageId } : {}, [profile.id], !pageId);
      await ensure("detail_meta", competitor, pageId ? { engine: "meta_ad_library", page_id: pageId, country: "IN" } : {}, [profile.id], !pageId);
    }
  }
  tasks = await tasksFor(scan);
  for (const competitor of competitors.filter(row => row.research_status === "loading")) {
    const related = tasks.filter(row => row.payload.competitor_id === competitor.id);
    const ready = ["detail_products", "detail_linkedin", "detail_reddit", "detail_facebook", "detail_reviews", "detail_meta"].every(kind => related.some(row => row.kind === kind));
    // Progressively publish purchased evidence, without an extra AI summary call.
    const rows = (await observationsFor(scan)).filter(row => row.competitor_id === competitor.id);
    const products = rows.filter(row => row.evidence_kind === "product_price");
    const ads = rows.filter(row => ["meta_ad", "linkedin_ad", "reddit_ad"].includes(row.evidence_kind));
    const profiles = rows.filter(row => row.evidence_kind === "social_profile");
    const reviews = rows.filter(row => row.evidence_kind === "facebook_review");
    const positive = reviews.filter(row => objectValue(row.attributes).recommendation === "recommends").length;
    const negative = reviews.filter(row => objectValue(row.attributes).recommendation === "doesn't recommend").length;
    const done = ready && related.every(row => terminalTask(row.status));
    const old = objectValue((await competitorsFor(scan)).find(row => row.id === competitor.id)?.research_summary);
    const pending = done ? "Unavailable from retrieved sources" : "Fetching…";
    const followers = objectValue(profiles[0]?.attributes).followers;
    const summary = { ...old, product_price: products.length ? textValue(products[0].source_snippet, 350) || products[0].source_title : pending,
      campaign: ads.length ? `${ads.length} public ads saved. ${ads.filter(row => row.evidence_kind === "linkedin_ad").length ? "LinkedIn matches are by advertiser name; review sources." : "Open Ads for creative and source dates."}` : pending,
      social: profiles.length ? `Facebook profile${typeof followers === "number" ? ` · ${followers.toLocaleString("en-IN")} followers` : ""}. Open profile for public details.` : pending,
      sentiment: reviews.length ? `Sampled Facebook reviews: ${positive} recommend, ${negative} do not recommend; ${reviews.length - positive - negative} without a recommendation label.` : pending,
      sentiment_sample_size: reviews.length, evidence_ids: rows.map(row => row.id),
      field_evidence_ids: { product_price: products.map(row => row.id), campaign: ads.map(row => row.id), social: profiles.map(row => row.id), sentiment: reviews.map(row => row.id) },
      detail_errors: related.filter(row => ["failed", "uncertain"].includes(row.status)).map(row => ({ kind: row.kind, code: row.error_code })),
    };
    await checked(db().from("brand_competitors").update({ research_summary: summary, research_status: done ? (products.length && ads.length && profiles.length && reviews.length ? "complete" : "partial") : "loading", ...(done ? { enriched_at: now() } : {}) }).eq("id", competitor.id));
  }
  if (tasks.some(row => !terminalTask(row.status))) { await setStage(scan, competitors.length ? "evidence" : "discovery"); return; }
  // Atomically re-check the queue so a concurrent Get cannot be closed by a stale reader.
  await checked(db().rpc("complete_on_demand_research", { target_scan_id: scan.id }));
}
