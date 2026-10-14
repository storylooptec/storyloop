import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Exercise the real task graph, ownership checks, validation and checkpoint logic.
// SQL locking/budgets have a separate database suite. Here the DB and both paid transports are in memory.
const root = new URL("../", import.meta.url);
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`;
const competitionUrl = new URL("src/brand/competition.ts", root).href;
const runtime = await readFile(new URL("src/lib/providers/runtime.ts", root), "utf8");
const costFunction = runtime.slice(runtime.indexOf("export function configuredOpenAICost"), runtime.indexOf("/** Local cache reads"));
const normalizerSource = (await readFile(new URL("src/brand/research-normalize.ts", root), "utf8")).replace('from "./competition"', `from ${JSON.stringify(competitionUrl)}`);
const normalizerUrl = compile(normalizerSource);
class ProviderError extends Error { constructor(code) { super(code); this.code = code; } }
class SearchApiError extends Error { constructor(code, status = null, retryAfter = null, uncertain = false) { super(code); Object.assign(this, { code, status, retryAfter, uncertain }); } }
globalThis.__storyloopWorkerTest = { ProviderError, SearchApiError };
const aiSource = (await readFile(new URL("src/lib/providers/research-openai.ts", root), "utf8"))
  .replace('import "server-only";', "")
  .replace('from "@/brand/competition"', `from ${JSON.stringify(competitionUrl)}`)
  .replace('import { configuredOpenAICost, ProviderError } from "@/lib/providers/runtime";', `${costFunction}\nconst { ProviderError } = globalThis.__storyloopWorkerTest;`);
const ai = await import(compile(aiSource));
globalThis.__storyloopWorkerTest.ai = ai;
const workerSource = (await readFile(new URL("src/lib/research/worker.ts", root), "utf8"))
  .replace('import "server-only";', "")
  .replace('from "@/brand/competition"', `from ${JSON.stringify(competitionUrl)}`)
  .replace('from "@/brand/research-normalize"', `from ${JSON.stringify(normalizerUrl)}`)
  .replace(/import \{[^\n]+\} from "@\/lib\/providers\/searchapi";/, 'const { SearchApiError } = globalThis.__storyloopWorkerTest; const callSearchApi = (...args) => globalThis.__storyloopWorkerTest.scenario.search(...args); const fetchSearchApiAccount = () => globalThis.__storyloopWorkerTest.scenario.account();')
  .replace(/import \{[^\n]+\} from "@\/lib\/providers\/research-openai";/, 'const { excludeOwnBrand, normalizeDiscoveryResponse, prepareDiscoveryRequest, prepareCandidateRequest, prepareFallbackRequest, prepareSummaryRequest, validateResearchCandidates, validateResearchSummary } = globalThis.__storyloopWorkerTest.ai; const invokeResearchOpenAI = (...args) => globalThis.__storyloopWorkerTest.scenario.ai(...args);')
  .replace('import { ProviderError } from "@/lib/providers/runtime";', 'const { ProviderError } = globalThis.__storyloopWorkerTest;')
  .replace('import { officialSocialLinks } from "./official-links";', 'const officialSocialLinks = async (url) => { const domain = new URL(url).hostname; const name = domain.split(".")[0]; return ["https://www.instagram.com/parentcorporation/", "https://www.instagram.com/" + name + "care/"]; };')
  .replace('import { researchDb, searchApiKey, researchConfigurationError } from "./db";', 'const researchDb = () => globalThis.__storyloopWorkerTest.scenario.db; const searchApiKey = () => "fixture-key"; const researchConfigurationError = () => null;')
  .replace(/import \{ terminalTask,[^\n]+\} from "\.\/types";/, 'const terminalTask = (status) => ["succeeded", "failed", "skipped", "uncertain"].includes(status);');
const { runResearchWorker, recoverSavedResearch } = await import(compile(workerSource));

const id = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const brands = ["Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((name) => ({ name, domain: `${name.toLowerCase()}.in`, handle: `${name.toLowerCase()}care`, post: `${name}Post` }));
const instant = () => new Date().toISOString();
const terminal = (status) => ["succeeded", "failed", "skipped", "uncertain"].includes(status);
const clone = (value) => structuredClone(value);
function scan(n, source = null) {
  return { id: id(n), company_id: id(90), campaign_id: id(n + 100), provider_key: "searchapi", status: "queued", stage: "queued", cache_from_scan_id: source,
    payload: { brand: "Acme", product: "Toothpaste", ownDomain: "acme.in" }, deadline_at: new Date(Date.now() + 900_000).toISOString(), created_at: instant(), requests_used: 0, cache_hits: 0 };
}
function hit(brand, url, snippet = `${brand.name} oral care products`) {
  return { title: `${brand.name} oral care`, url, snippet, sourceDate: "October 12, 2026", asin: null, rating: null, reviewCount: null, price: null, priceText: null };
}
function emptyPayload() { return { searchId: "fixture-search", hits: [], evidence: [], instagramUsername: null, postId: null, profileWebsite: null }; }
function normalizedResponse(params) {
  const payload = emptyPayload();
  const brand = brands.find((item) => [params.q, params.domain, params.username, params.post_id].some((value) => value?.toLowerCase().includes(item.name.toLowerCase())));
  if (params.engine === "google" && !brand) payload.hits = brands.map((item) => hit(item, `https://${item.domain}/`, `${item.name} competes in oral care and sells toothpaste in India`));
  else if (params.engine === "google" && params.q.startsWith("site:")) payload.hits = [hit(brand, `https://${brand.domain}/toothpaste`, `${brand.name} toothpaste costs INR 200 per 100g pack`)];
  else if (params.engine === "google") payload.hits = [hit(brand, `https://${brand.domain}/`), hit(brand, `https://www.instagram.com/${brand.handle}/`)];
  else if (params.engine === "meta_ad_library" || params.engine === "google_ads_transparency_center") {
    const kind = params.engine === "meta_ad_library" ? "meta_ad" : "google_ad";
    payload.evidence = [{ kind, title: `${brand.name} advertisement`, url: kind === "meta_ad" ? `https://www.facebook.com/ads/library/?id=${brands.indexOf(brand) + 1}` : `https://adstransparency.google.com/advertiser/${brand.name}/creative/1`, text: `${brand.name} advertises toothpaste`, sourceDate: "October 12, 2026", attributes: { targetDomain: brand.domain, advertiser: brand.name } },
      { kind, title: `${brand.name} unrelated advertiser`, url: `https://unrelated.example/ad/${brand.name}`, text: "This must not be attributed to the brand", sourceDate: null, attributes: { targetDomain: "unrelated.example", advertiser: brand.name } }];
  } else if (params.engine === "instagram_profile") {
    Object.assign(payload, { instagramUsername: brand.handle, postId: brand.post, profileWebsite: `https://${brand.domain}/` });
    payload.evidence = [{ kind: "social_post", title: `${brand.name} Instagram post`, url: `https://www.instagram.com/p/${brand.post}/`, text: `${brand.name} demonstrates toothpaste`, sourceDate: "October 12, 2026", attributes: { postId: brand.post } }];
  } else if (params.engine === "instagram_comments") {
    payload.postId = brand.post;
    payload.evidence = ["I like the taste", "Delivery was late"].map((text, n) => ({ kind: "social_comment", title: "Instagram comment", url: `https://www.instagram.com/p/${brand.post}/`, text, sourceDate: "October 12, 2026", attributes: { postId: brand.post, commentId: String(n + 1) } }));
  } else throw new Error(`Unexpected engine: ${params.engine}`);
  return payload;
}

class Query {
  constructor(scenario, table) { this.scenario = scenario; this.table = table; this.filters = []; this.mode = "select"; this.max = Infinity; }
  select() { return this; }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
  gt(key, value) { this.filters.push((row) => row[key] > value); return this; }
  order(key) { this.orderKey = key; return this; }
  limit(value) { this.max = value; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  update(patch) { this.mode = "update"; this.patch = clone(patch); return this; }
  upsert(values, options = {}) { this.mode = "upsert"; this.values = Array.isArray(values) ? values : [values]; this.options = options; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    const table = this.scenario.tables[this.table];
    assert.ok(table, `Unexpected table ${this.table}`);
    if (this.mode === "upsert") {
      if (this.table === "brand_research_tasks") this.scenario.taskWrites += this.values.length;
      for (const value of this.values) {
        const keys = (this.options.onConflict ?? "id").split(",");
        const existing = table.find((row) => keys.every((key) => row[key] === value[key]));
        if (existing) { if (!this.options.ignoreDuplicates) Object.assign(existing, clone(value)); }
        else table.push({ result: {}, attempt_count: 0, next_attempt_at: instant(), created_at: instant(), ...clone(value) });
      }
      return { data: null, error: null };
    }
    let rows = table.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderKey) rows = rows.sort((a, b) => String(a[this.orderKey]).localeCompare(String(b[this.orderKey])));
    rows = rows.slice(0, this.max);
    if (this.mode === "update") rows.forEach((row) => Object.assign(row, clone(this.patch)));
    return { data: clone(this.one ? rows[0] ?? null : rows), error: null };
  }
}
function scenario(mode = "success") {
  const context = {
    tables: { brand_research_control: [{ id: true, enabled: true, account_checked_at: instant() }], brand_competitor_scans: [scan(1)], brand_research_tasks: [], brand_competitors: [], brand_competitor_observations: [], brand_research_cache: [], brand_campaigns: [{ id: id(101), company_id: id(90), status: "scanning" }] },
    searches: [], aiCalls: [], attempts: [], accounts: 0, taskWrites: 0,
    account: async () => { context.accounts += 1; return { hourlyRemaining: 1000 }; },
    search: async (params) => {
      context.searches.push(clone(params));
      assert.equal(context.attempts.at(-1)?.provider, "searchapi", "paid search must have a preceding reservation");
      if (mode === "uncertain") throw new SearchApiError("provider_timeout", null, null, true);
      return normalizedResponse(params);
    },
    ai: async (prepared) => {
      context.aiCalls.push(prepared.kind);
      const payload = JSON.parse(prepared.body);
      let value;
      if (prepared.kind === "candidates") {
        const input = JSON.parse(payload.messages[1].content);
        value = { competitors: brands.map((brand) => ({ name: brand.name, official_domain: brand.domain, rationale: "Competes in oral care", evidence_ids: [input.sources.find((source) => source.source_title.includes(brand.name)).id] })) };
      } else if (prepared.kind === "summary") {
        const input = JSON.parse(payload.messages[1].content);
        value = { competitors: input.competitors.map((competitor) => {
          const rows = input.evidence.filter((row) => row.competitor_id === competitor.id);
          return { id: competitor.id, product_price: "Toothpaste at INR 200 per 100g", campaign: "Toothpaste advertising observed", social: "Product demonstration post", sentiment: "Mixed feedback on taste and delivery", sentiment_sample_size: 999,
            field_evidence_ids: { product_price: [rows.find((row) => row.evidence_kind === "product_price").id], campaign: [rows.find((row) => row.evidence_kind === "meta_ad").id], social: [rows.find((row) => row.evidence_kind === "social_post").id], sentiment: rows.filter((row) => row.evidence_kind === "social_comment").map((row) => row.id) } };
        }) };
      } else throw new Error("Fallback should not be called in these scenarios");
      return { value, requestId: `fixture-${prepared.kind}`, inputTokens: 1000, outputTokens: 100 };
    },
  };
  context.db = { from: (table) => new Query(context, table), rpc: async (name, args) => {
    const tasks = context.tables.brand_research_tasks;
    if (name === "complete_on_demand_research") {
      const scan = context.tables.brand_competitor_scans.find(row => row.id === args.target_scan_id);
      if (tasks.some(row => row.scan_id === scan.id && !terminal(row.status))) return {data:false,error:null};
      Object.assign(scan, {status:context.tables.brand_competitors.length ? "succeeded" : "failed", stage:"complete"});
      return {data:true,error:null};
    }
    if (name === "claim_research_task") {
      const task = tasks.find((row) => row.status === "queued" && row.next_attempt_at <= instant() && row.dependencies.every((dependency) => terminal(tasks.find((item) => item.id === dependency)?.status)));
      if (!task) return { data: null, error: null };
      Object.assign(task, { status: "running", lease_token: `lease-${task.id}` });
      return { data: clone(task), error: null };
    }
    if (name === "reserve_research_attempt") {
      const task = tasks.find((row) => row.id === args.task_id);
      assert.equal(task.lease_token, args.lease);
      if (mode === "budget") return { data: { allowed: false, error: "research_daily_budget" }, error: null };
      const attempt = { id: id(1000 + context.attempts.length), task_id: task.id, provider: args.provider, status: "reserved" };
      context.attempts.push(attempt); task.attempt_count += 1;
      return { data: { allowed: true, attempt_id: attempt.id }, error: null };
    }
    if (name === "finish_research_attempt") {
      Object.assign(context.attempts.find((row) => row.id === args.attempt_id), args.outcome);
      return { data: true, error: null };
    }
    if (name === "finish_research_task") {
      const task = tasks.find((row) => row.id === args.task_id);
      assert.equal(task.lease_token, args.lease);
      Object.assign(task, { status: args.task_status, result: clone(args.task_result), error_code: args.failure_code, next_attempt_at: args.retry_at ?? instant(), lease_token: null });
      return { data: true, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  } };
  return context;
}
async function using(context, work) {
  globalThis.__storyloopWorkerTest.scenario = context;
  const names = ["OPENAI_INPUT_COST_PER_1M_USD", "OPENAI_OUTPUT_COST_PER_1M_USD", "OPENAI_WEB_SEARCH_COST_PER_CALL_USD", "OPENAI_API_KEY"];
  const previous = names.map((key) => process.env[key]);
  names.forEach((key, i) => process.env[key] = ["0.4", "1.6", "0.01", "fixture-key"][i]);
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Live requests are forbidden in worker tests"); };
  try { await work(); } finally { globalThis.fetch = fetch; names.forEach((key, i) => previous[i] === undefined ? delete process.env[key] : process.env[key] = previous[i]); }
}

test("whole research DAG produces five grounded summaries, rejects unrelated ads, and reuses a campaign snapshot without paid calls", async () => {
  const context = scenario();
  await using(context, async () => {
    await runResearchWorker();
    const original = context.tables.brand_competitor_scans[0];
    assert.equal(original.status, "succeeded");
    assert.equal(original.result_count, 5);
    assert.equal(context.searches.length, 26);
    assert.deepEqual(context.aiCalls, ["candidates", "summary"]);
    assert.equal(context.searches.some(params => params.username === "parentcorporation"), false, "Corporate footer accounts are not attributed to the brand");
    assert.equal(context.tables.brand_research_tasks.every((task) => terminal(task.status)), true);
    assert.equal(context.taskWrites, context.tables.brand_research_tasks.length, "advancing a scan must not repeatedly write existing tasks");
    const originals = context.tables.brand_competitors.filter((row) => row.scan_id === original.id);
    for (const competitor of originals) {
      assert.equal(competitor.research_status, "complete");
      assert.equal(competitor.research_summary.sentiment_sample_size, 2);
      for (const evidenceId of competitor.research_summary.evidence_ids) {
        const evidence = context.tables.brand_competitor_observations.find((row) => row.id === evidenceId);
        assert.equal(evidence.competitor_id, competitor.id);
        assert.equal(evidence.scan_id, original.id);
      }
    }
    assert.equal(context.tables.brand_competitor_observations.some((row) => row.source_url.includes("unrelated.example")), false);
    await runResearchWorker();
    assert.equal(context.searches.length, 26, "reinvoking a completed job must not repeat searches");
    assert.equal(context.aiCalls.length, 2);

    const reused = scan(2, original.id);
    context.tables.brand_competitor_scans.push(reused);
    context.tables.brand_campaigns.push({ id: reused.campaign_id, company_id: reused.company_id, status: "scanning" });
    await runResearchWorker();
    assert.equal(reused.status, "succeeded");
    assert.equal(reused.cache_hits, 1);
    assert.equal(context.searches.length, 26, "snapshot reuse must perform zero paid searches");
    assert.equal(context.aiCalls.length, 2, "snapshot reuse must not regenerate summaries");
    const copied = context.tables.brand_competitors.filter((row) => row.scan_id === reused.id);
    assert.equal(copied.length, 5);
    for (const competitor of copied) {
      assert.equal(competitor.campaign_id, reused.campaign_id);
      assert.equal(competitor.research_summary.id, competitor.id);
      for (const evidenceId of competitor.research_summary.evidence_ids) {
        const evidence = context.tables.brand_competitor_observations.find((row) => row.id === evidenceId);
        assert.equal(evidence.competitor_id, competitor.id);
        assert.equal(evidence.scan_id, reused.id);
      }
    }
  });
});

test("brief pacing pause keeps the task lease and reserves only one paid attempt", async () => {
  const context = scenario();
  const rpc = context.db.rpc;
  let denied = false;
  const queued = [];
  context.db.rpc = async (name, args) => {
    if (name === "reserve_research_attempt" && !denied) {
      denied = true;
      return { data: { allowed: false, error: "provider_pacing", retry_after: 1 }, error: null };
    }
    if (name === "finish_research_task" && args.task_status === "queued") queued.push(args);
    return rpc(name, args);
  };
  await using(context, async () => {
    await runResearchWorker();
    assert.equal(context.tables.brand_competitor_scans[0].status, "succeeded");
    assert.equal(context.searches.length, 26);
    assert.equal(queued.length, 0, "one-second pacing must not wait for a scheduler tick");
  });
});

test("weak verification stops before spending on ads, profiles, comments or summarization", async () => {
  const context = scenario();
  const original = context.search;
  context.search = async params => {
    const response = await original(params);
    if (params.engine === "google" && !params.q.includes('official website')) response.hits = brands.map(item => hit(item, `https://news.example/${item.name}`));
    if (params.q?.includes('official website') && !params.q.includes('Beta')) response.hits = [];
    return response;
  };
  await using(context, async () => {
    await runResearchWorker();
    assert.equal(context.tables.brand_competitor_scans[0].error_code, "insufficient_verified_competitors");
    assert.equal(context.tables.brand_competitor_scans[0].result_count, 1);
    assert.equal(context.searches.length, 6);
    assert.deepEqual(context.aiCalls, ["candidates"]);
    assert.equal(context.searches.every(params => params.engine === "google"), true);
  });
});

test("a second discovery search runs only when the first extraction is short", async () => {
  const context = scenario();
  const original = context.ai;
  let extraction = 0;
  context.ai = async prepared => {
    const response = await original(prepared);
    if (prepared.kind === "candidates" && ++extraction === 1) response.value.competitors = response.value.competitors.slice(0, 2);
    return response;
  };
  await using(context, async () => {
    await runResearchWorker();
    assert.equal(context.tables.brand_competitor_scans[0].result_count, 5);
    assert.equal(context.tables.brand_research_tasks.filter(t => t.kind === "discovery").length, 2);
    assert.deepEqual(context.aiCalls, ["candidates", "candidates", "summary"]);
    assert.equal(context.searches.length, 27);
  });
});

test("saved-result repair is idempotent and never invokes a paid transport", async () => {
  const context = scenario();
  await using(context, async () => {
    await runResearchWorker();
    const requestCount = context.searches.length;
    const aiCount = context.aiCalls.length;
    const evidenceCount = context.tables.brand_competitor_observations.length;
    context.search = context.ai = async () => { throw new Error("Repair must not spend"); };
    const current = context.tables.brand_competitor_scans[0];
    await recoverSavedResearch(current);
    await recoverSavedResearch(current);
    assert.equal(context.searches.length, requestCount);
    assert.equal(context.aiCalls.length, aiCount);
    assert.equal(context.tables.brand_competitor_observations.length, evidenceCount);
    assert.equal(context.tables.brand_competitors.length, 5);
  });
});

test("saved profile repair rejects a different returned username even with an official website", async () => {
  const context = scenario();
  await using(context, async () => {
    await runResearchWorker();
    const profile = context.tables.brand_research_tasks.find(task => task.kind === "instagram_profile");
    profile.result.response.instagramUsername = "unrelatedprofile";
    await recoverSavedResearch(context.tables.brand_competitor_scans[0]);
    assert.equal(profile.result.profile_verified, false);
    assert.equal(profile.result.post_id, null);
  });
});

test("busy concurrency slot rechecks in seconds without weakening provider rate-limit backoff", async () => {
  for (const code of ["provider_concurrency", "provider_rate_limited"]) {
    const context = scenario();
    const rpc = context.db.rpc;
    let denied = false;
    let delay;
    context.db.rpc = async (name, args) => {
      if (name === "reserve_research_attempt" && !denied) {
        denied = true;
        return { data: { allowed: false, error: code, retry_after: 60 }, error: null };
      }
      if (name === "finish_research_task" && args.task_status === "queued") delay = Date.parse(args.retry_at) - Date.now();
      return rpc(name, args);
    };
    await using(context, async () => { await runResearchWorker(); });
    assert.ok(delay >= (code === "provider_concurrency" ? 1900 : 59000));
    assert.ok(delay <= (code === "provider_concurrency" ? 2100 : 61000));
  }
});

test("budget denial ends paid work without triggering cross-provider fallback", async () => {
  const context = scenario("budget");
  await using(context, async () => {
    await runResearchWorker(); await runResearchWorker();
    assert.equal(context.searches.length, 0);
    assert.equal(context.aiCalls.length, 0);
    assert.equal(context.attempts.length, 0);
    assert.equal(context.tables.brand_research_tasks.some((task) => task.kind === "fallback"), false);
    assert.equal(context.tables.brand_research_tasks.filter((task) => task.kind === "discovery" && task.status === "failed").length, 1);
  });
});

test("finishing a summary publishes completion even when the drain window has elapsed", async () => {
  const context = scenario();
  const originalAi = context.ai;
  const originalNow = Date.now;
  context.ai = async prepared => {
    const response = await originalAi(prepared);
    if (prepared.kind === "summary") Date.now = () => originalNow() + 26000;
    return response;
  };
  try {
    await using(context, async () => {
      await runResearchWorker();
      assert.equal(context.tables.brand_competitor_scans[0].status, "succeeded");
      assert.equal(context.tables.brand_competitor_scans[0].stage, "complete");
    });
  } finally { Date.now = originalNow; }
});

test("uncertain provider outcomes stay terminal with no automatic retry or fallback spend", async () => {
  const context = scenario("uncertain");
  await using(context, async () => {
    await runResearchWorker(); await runResearchWorker();
    assert.equal(context.searches.length, 1);
    assert.equal(context.aiCalls.length, 0);
    assert.equal(context.attempts.length, 1);
    assert.equal(context.attempts.every((attempt) => attempt.status === "uncertain"), true);
    assert.equal(context.tables.brand_research_tasks.some((task) => task.kind === "fallback"), false);
    assert.equal(context.tables.brand_research_tasks.filter((task) => task.kind === "discovery" && task.status === "uncertain").length, 1);
  });
});


test("native discovery stops at five cards with zero SearchAPI calls, including account checks", async () => {
  const context = scenario(); context.tables.brand_competitor_scans[0].payload.flow = "on_demand_v2";
  context.tables.brand_research_control[0].account_checked_at = null;
  context.ai = async request => {
    context.aiCalls.push(request.kind); assert.equal(request.kind, "discovery");
    assert.equal(JSON.parse(request.body).tools[0].type, "web_search");
    return { value: { competitors: brands.map(b => ({name:b.name,official_domain:b.domain,website:`https://${b.domain}/`,rationale:"Same category and market",source_urls:[`https://${b.domain}/`],social_links:[]})) },requestId:"discovery-test",inputTokens:1000,outputTokens:1000 };
  };
  await using(context, async () => { await runResearchWorker(); await runResearchWorker(); });
  assert.equal(context.tables.brand_competitors.length,5);
  assert.ok(context.tables.brand_competitors.every(row => row.research_status === "not_fetched"));
  assert.deepEqual(context.aiCalls,["discovery"]); assert.equal(context.searches.length,0); assert.equal(context.accounts,0);
  assert.deepEqual(context.tables.brand_research_tasks.map(row=>row.kind),["native_discovery"]);
  assert.equal(context.tables.brand_competitor_scans[0].status,"succeeded");
});

test("a captured discovery response resumes without repurchasing a provider request", async () => {
  const context=scenario(); const scan=context.tables.brand_competitor_scans[0];scan.payload.flow="on_demand_v2";scan.status="running";
  const snapshot=JSON.parse(await readFile(new URL("./fixtures/openai-discovery-bengaluru.json",import.meta.url),"utf8"));
  context.tables.brand_research_tasks.push({id:id(590),company_id:scan.company_id,campaign_id:scan.campaign_id,scan_id:scan.id,kind:"native_discovery",dedupe_key:"native_discovery",status:"queued",payload:{},result:{openai_response:snapshot},dependencies:[],attempt_count:1,next_attempt_at:instant()});
  context.ai=async()=>{throw new Error("Captured response must not be purchased again");};
  await using(context,async()=>{await runResearchWorker();});
  assert.equal(context.attempts.length,0);assert.equal(context.searches.length,0);assert.equal(context.accounts,0);
  assert.equal(context.tables.brand_research_tasks[0].status,"succeeded");
  assert.equal(context.tables.brand_research_tasks[0].result.competitor_count,0);
});

test("one requested competitor buys at most seven first-page requests; other cards stay untouched", async () => {
  const context = scenario(); const scan = context.tables.brand_competitor_scans[0]; scan.payload.flow = "on_demand_v2"; scan.status="running";
  context.tables.brand_research_tasks.push({id:id(500),company_id:scan.company_id,campaign_id:scan.campaign_id,scan_id:scan.id,kind:"native_discovery",dedupe_key:"native_discovery",status:"succeeded",payload:{},result:{},dependencies:[]});
  context.tables.brand_competitors = brands.map((b,i)=>({id:id(600+i),scan_id:scan.id,company_id:scan.company_id,campaign_id:scan.campaign_id,name:b.name,official_domain:b.domain,research_status:i===0?"loading":"not_fetched",research_summary:{website:`https://${b.domain}/`,social_links:[]}}));
  const competitor = context.tables.brand_competitors[0];
  for(const [kind,params] of [["detail_products",{engine:"google",q:"site:beta.in products prices"}],["detail_linkedin",{engine:"linkedin_ad_library",advertiser:"Beta"}],["detail_reddit",{engine:"reddit_ad_library",q:"Beta"}]]) context.tables.brand_research_tasks.push({id:id(700+context.tables.brand_research_tasks.length),scan_id:scan.id,company_id:scan.company_id,campaign_id:scan.campaign_id,kind,dedupe_key:`${kind}:${competitor.id}`,payload:{competitor_id:competitor.id,params},status:"queued",result:{},dependencies:[],attempt_count:0,next_attempt_at:instant()});
  context.search = async params => {
    context.searches.push(params); const response=emptyPayload();
    if(params.engine === "meta_ad_library_page_search") response.pages=[{id:"12345",name:"Beta",country:"IN"}];
    if(params.engine === "facebook_business_page") response.facebookPage={id:"12345",name:"Beta",url:"https://www.facebook.com/beta",website:"https://beta.in/",username:"beta",instagram:null};
    return response;
  };
  context.ai = async () => {throw new Error("Get must not call OpenAI");};
  await using(context,async()=>{await runResearchWorker();await runResearchWorker();});
  assert.equal(context.searches.length,7); assert.equal(context.aiCalls.length,0);
  assert.equal(context.tables.brand_competitors[0].research_status,"partial");
  assert.ok(context.tables.brand_competitors.slice(1).every(row=>row.research_status==="not_fetched"));
  assert.ok(context.searches.every(params=>!('page' in params)&&!('next_page_token' in params)));
  const paid=context.searches.length; await using(context,async()=>{await runResearchWorker();}); assert.equal(context.searches.length,paid);
});
