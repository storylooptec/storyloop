import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Keep the real cost formula, with server-only and DB wiring omitted. Every fetch is mocked.
const runtime = await readFile(new URL("../src/lib/providers/runtime.ts", import.meta.url), "utf8");
const costFunction = runtime.slice(runtime.indexOf("export function configuredOpenAICost"), runtime.indexOf("/** Local cache reads"));
const competitionUrl = new URL("../src/brand/competition.ts", import.meta.url).href;
const source = (await readFile(new URL("../src/lib/providers/research-openai.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('from "@/brand/competition"', `from ${JSON.stringify(competitionUrl)}`)
  .replace('import { configuredOpenAICost, ProviderError } from "@/lib/providers/runtime";', `${costFunction}\nclass ProviderError extends Error { constructor(public code: string, public retryAfterSeconds=60, public usage?: unknown) { super(code); } }`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const adapter = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const id = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const competitors = [{ id: id(1), name: "Beta", official_domain: "beta.in" }, { id: id(2), name: "Gamma", official_domain: "gamma.in" }];
const row = (n, kind, competitor = id(1), text = "An observed item") => ({ id: id(n), competitor_id: competitor, evidence_kind: kind, source_title: "Beta source", source_snippet: text, source_url: `https://beta.in/evidence/${n}`, observed_at: "2026-10-12T12:00:00Z", published_at: null, source_date_text: null });
const evidence = [row(10, "product_price"), row(11, "meta_ad"), row(12, "social_post"), row(13, "social_comment", id(1), "I like this product"), row(14, "amazon_review", id(1), "It arrived late"), row(15, "social_comment", id(2), "Different brand comment"), row(16, "web_fallback")];
const valid = { competitors: [{ id: id(1), product_price: "Product listed", campaign: "An advertisement was observed", social: "A product post was observed", sentiment: "Mixed feedback about the product and delivery", sentiment_sample_size: 999, evidence_ids: ["made-up"], field_evidence_ids: { product_price: [id(10)], campaign: [id(11)], social: [id(12)], sentiment: [id(13), id(14)] }, secret: "not saved" }] };
async function configured(run, overrides = {}) {
  const settings = { OPENAI_INPUT_COST_PER_1M_USD: "0.4", OPENAI_OUTPUT_COST_PER_1M_USD: "1.6", OPENAI_WEB_SEARCH_COST_PER_CALL_USD: "0.01", ...overrides };
  const old = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.entries(settings).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
  try { await run(); } finally { Object.entries(old).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value); }
}
async function mockedFetch(fetch, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetch;
  try { await run(); } finally { globalThis.fetch = previous; }
}
function fallbackBody() {
  const text = "Beta lists oral care products. [source]";
  return { id: "resp_123", status: "completed", usage: { input_tokens: 8000, output_tokens: 150 }, output: [
    { type: "web_search_call", status: "completed", action: { type: "search", query: "Beta" } },
    { type: "message", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", title: "Beta products", url: "https://beta.in/products?api_key=secret", start_index: 30, end_index: text.length }] }] },
  ] };
}

test("candidate extraction keeps only supplied named competitors and valid source UUIDs", async () => configured(async () => {
  const sources = [row(30, "discovery", null, "Beta offers oral care products"), { ...row(31, "discovery"), id: "not-a-uuid" }];
  const prepared = adapter.prepareCandidateRequest("Acme", "Toothpaste", "acme.in", sources);
  const body = JSON.parse(prepared.body);
  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(JSON.parse(body.messages[1].content).sources.length, 1);
  assert.match(body.messages[0].content, /untrusted data/);
  assert.equal(prepared.reservedInputTokens, Buffer.byteLength(prepared.body) + 1024);
  const candidates = adapter.validateResearchCandidates({ competitors: [
    { name: "Beta", official_domain: "beta.in", rationale: "Same category", evidence_ids: [id(30)] },
    { name: "Invented", official_domain: "invented.in", rationale: "Unsupported", evidence_ids: [id(30)] },
  ] }, sources, "Acme", "acme.in");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Beta");
}));

test("summary removes model extras, computes actual cited sample count, and fills missing competitors", () => {
  const result = adapter.validateResearchSummary(valid, competitors, evidence);
  assert.equal(result.competitors[0].sentiment_sample_size, 2);
  assert.match(result.competitors[0].sentiment, /^Sampled comments:/);
  assert.deepEqual(result.competitors[0].evidence_ids, [id(10), id(11), id(12), id(13), id(14)]);
  assert.equal(result.competitors[0].secret, undefined);
  assert.equal(result.competitors[1].sentiment, "Insufficient evidence");
  assert.equal(result.competitors[1].sentiment_sample_size, 0);
});

test("foreign, invented, wrong-kind or partially valid citations invalidate the entire field", () => {
  for (const ids of [[id(15)], [id(999)], [id(11)], [id(16)], [id(13), id(15)]]) {
    const input = structuredClone(valid);
    input.competitors[0].field_evidence_ids.sentiment = ids;
    const result = adapter.validateResearchSummary(input, competitors, evidence).competitors[0];
    assert.equal(result.sentiment, "Insufficient evidence");
    assert.equal(result.sentiment_sample_size, 0);
    assert.deepEqual(result.field_evidence_ids.sentiment, []);
  }
  const input = structuredClone(valid);
  input.competitors[0].field_evidence_ids.campaign = [id(12)];
  assert.equal(adapter.validateResearchSummary(input, competitors, evidence).competitors[0].campaign, "Insufficient evidence");
});

test("summary sampling deduplicates actual comment text and includes at most 20 comments per competitor", async () => configured(async () => {
  const comments = Array.from({ length: 40 }, (_, i) => row(100 + i, "social_comment", id(1), `Comment ${i}`));
  comments.push({ ...comments[0], id: id(500) });
  const selected = adapter.selectResearchSummaryEvidence(competitors, [...evidence, ...comments]);
  assert.equal(selected.filter((item) => item.competitor_id === id(1) && ["social_comment", "amazon_review"].includes(item.evidence_kind)).length, 20);
  assert.equal(selected.some((item) => item.id === id(500)), false);
  const request = adapter.prepareSummaryRequest(competitors, [...evidence, ...comments]);
  const input = JSON.parse(JSON.parse(request.body).messages[1].content);
  assert.deepEqual(input.evidence, selected);
  assert.equal(request.outputTokens, 4000);
}));

test("fallback requires one live hosted search and reserves context plus configured tool cost", async () => configured(async () => {
  const request = adapter.prepareFallbackRequest("Beta oral care India");
  const body = JSON.parse(request.body);
  assert.equal(request.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(body.tool_choice, "required");
  assert.equal(body.max_tool_calls, 1);
  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].type, "web_search");
  assert.equal(body.tools[0].external_web_access, true);
  assert.equal(request.reservedInputTokens, 128_000 + Buffer.byteLength(request.body) + 1024);
  assert.equal(request.estimatedCostUsd, (request.reservedInputTokens * 0.4 + request.outputTokens * 1.6) / 1_000_000 + 0.01);
}));

test("verified default prices work; incomplete overrides fail closed", async () => {
  await configured(async () => assert.ok(adapter.prepareFallbackRequest("Beta").estimatedCostUsd > 0.01), { OPENAI_WEB_SEARCH_COST_PER_CALL_USD: undefined });
  await configured(async () => assert.throws(() => adapter.prepareCandidateRequest("Brand", "Product", null, []), { code: "provider_cost_not_configured" }), { OPENAI_INPUT_COST_PER_1M_USD: undefined });
});

test("fallback keeps only actual citation annotations and labels generated summary provenance", () => {
  const body = fallbackBody();
  body.output[1].content[0].text += '\n\n{"url":"https://invented.example/"}';
  const result = adapter.normalizeFallbackSources(body);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, "https://beta.in/products");
  assert.match(result.sources[0].text, /^Web-search generated summary \(not a direct quotation\):/);
  assert.equal(result.sources[0].text.includes("invented.example"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("fallback rejects memory-only answers, unfinished/multiple tool calls, and malformed annotations", () => {
  for (const mutate of [
    (body) => body.output.shift(),
    (body) => body.output.push(body.output[0]),
    (body) => body.status = "incomplete",
    (body) => body.output[0].status = "failed",
    (body) => body.output[1].content[0].annotations[0].url = "http://localhost/private",
    (body) => body.output[1].content[0].annotations[0].start_index = -1,
  ]) {
    const body = fallbackBody(); mutate(body);
    assert.throws(() => adapter.normalizeFallbackSources(body), { code: "invalid_ai_response" });
  }
});

test("invoke posts one fixed-host bounded request and returns parsed usage", async () => configured(async () => {
  const request = adapter.prepareFallbackRequest("Beta");
  let calls = 0;
  await mockedFetch(async (url, options) => {
    calls += 1;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.body, request.body);
    assert.equal(options.headers.Authorization, "Bearer fake-key");
    assert.equal(options.redirect, "error");
    assert.equal(options.signal instanceof AbortSignal, true);
    return new Response(JSON.stringify(fallbackBody()));
  }, async () => {
    const result = await adapter.invokeResearchOpenAI(request, "fake-key");
    assert.equal(result.requestId, "resp_123");
    assert.equal(result.inputTokens, 8000);
    assert.equal(result.outputTokens, 150);
    assert.equal(result.value.sources.length, 1);
  });
  assert.equal(calls, 1);
}));

test("429 and ambiguous transport failures are never retried or exposed as raw errors", async () => configured(async () => {
  const request = adapter.prepareFallbackRequest("Beta");
  for (const failure of ["rate", "timeout"]) {
    let calls = 0;
    await mockedFetch(async () => {
      calls += 1;
      if (failure === "timeout") throw new Error("provider secret should not escape");
      return new Response("provider secret should not escape", { status: 429, headers: { "retry-after": "17" } });
    }, async () => assert.rejects(adapter.invokeResearchOpenAI(request, "fake-key"), { code: failure === "rate" ? "provider_rate_limited" : "provider_timeout" }));
    assert.equal(calls, 1);
  }
}));

test("oversized response streams are stopped without JSON parsing or a second request", async () => configured(async () => {
  const request = adapter.prepareFallbackRequest("Beta");
  let canceled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1_048_577)); }, cancel() { canceled = true; } });
  await mockedFetch(async () => new Response(stream), async () => assert.rejects(adapter.invokeResearchOpenAI(request, "fake-key"), { code: "provider_response_too_large" }));
  assert.equal(canceled, true);
}));

test("untrusted endpoint changes cannot receive the API key", async () => configured(async () => {
  let calls = 0;
  const request = { ...adapter.prepareFallbackRequest("Beta"), endpoint: "https://evil.example/" };
  await mockedFetch(async () => { calls += 1; throw new Error("should not run"); }, async () => assert.rejects(adapter.invokeResearchOpenAI(request, "fake-key"), { code: "provider_invalid_request" }));
  assert.equal(calls, 0);
}));

test("truncated structured output preserves measured usage on its safe typed failure", async () => configured(async () => {
  const request = adapter.prepareSummaryRequest(competitors, evidence);
  await mockedFetch(async () => new Response(JSON.stringify({ id: "chatcmpl_safe", choices: [{ finish_reason: "length", message: { content: '{"competitors":[' } }], usage: { prompt_tokens: 300, completion_tokens: 4000 } })), async () => {
    await assert.rejects(adapter.invokeResearchOpenAI(request, "fake-key"), (error) => {
      assert.equal(error.code, "invalid_ai_response");
      assert.deepEqual(error.usage, { inputUnits: 300, outputUnits: 4000, providerRequestId: "chatcmpl_safe" });
      return true;
    });
  });
}));


test("native discovery requires retrieved official URLs, rejects invented domains and excludes the brand", async () => configured(async()=>{
  const request = adapter.prepareDiscoveryRequest("FootieFirst", "academy", "footiefirst.in");
  const body = JSON.parse(request.body);
  assert.equal(request.endpoint,"https://api.openai.com/v1/responses"); assert.equal(body.max_tool_calls,3);
  assert.deepEqual(body.include,["web_search_call.action.sources"]);
  assert.match(body.input,/^Find five direct competitors of "FootieFirst"/);
  assert.match(body.input,/official websites/);
  assert.throws(()=>JSON.parse(body.input),SyntaxError,"The web-search input must be a question, not serialized campaign data");
  assert.ok(request.estimatedCostUsd>=0.03); assert.ok(request.reservedInputTokens>=128000);
  const response = {status:"completed",output:[{type:"web_search_call",status:"completed",action:{type:"search",sources:[{url:"https://dynamicfootballacademy.com/"},{url:"https://footiefirst.in/"}]}},{type:"message",content:[{type:"output_text",text:JSON.stringify({competitors:[
    {name:"Dynamic Football Academy",website:"https://dynamicfootballacademy.com/",rationale:"Youth football training in India",source_urls:["https://dynamicfootballacademy.com/"],social_links:["https://instagram.com/invented"]},
    {name:"Invented domain",website:"https://dynamicfootballacademy.in/",rationale:"Not in sources",source_urls:[]},
    {name:"FootieFirst",website:"https://footiefirst.in/",rationale:"Own brand",source_urls:[]}
  ]})}]}]};
  const result = adapter.excludeOwnBrand(adapter.normalizeDiscoveryResponse(response).competitors,"FootieFirst","footiefirst.in");
  assert.equal(result.length,1);assert.equal(result[0].official_domain,"dynamicfootballacademy.com");assert.deepEqual(result[0].social_links,[]);
  await mockedFetch(async(url)=>{assert.equal(url,"https://api.openai.com/v1/responses");return Response.json({...response,id:"resp_discovery",usage:{input_tokens:2000,output_tokens:1000}});},async()=>{assert.equal((await adapter.invokeResearchOpenAI(request,"fixture")).value.competitors.length,2);});
  assert.throws(()=>adapter.normalizeDiscoveryResponse({...response,status:"incomplete"}),/invalid_ai_response/);
}));

test("captured Bengaluru response explains all five rejections without accepting invented websites", async () => {
  const response = JSON.parse(await readFile(new URL("./fixtures/openai-discovery-bengaluru.json",import.meta.url),"utf8"));
  const result = adapter.normalizeDiscoveryResponse(response);
  assert.equal(result.diagnostics.returned_count,5);
  assert.equal(result.diagnostics.source_count,12);
  assert.equal(result.competitors.length,0);
  assert.equal(result.diagnostics.rejected.length,5);
  assert.ok(result.diagnostics.rejected.every(row=>row.reason==="website_not_in_search_sources"));
  assert.match(result.diagnostics.rejected[0].website,/chennayinfc/);
});

test("discovery captures purchased output before filtering, with replayable sources and no credentials or hidden reasoning", async () => configured(async () => {
  const response = { id: "resp_capture", model: "gpt-4.1-mini", status: "completed", usage: { input_tokens: 8803, output_tokens: 367 }, secret: "not retained", output: [
    { type: "reasoning", summary: "not retained" },
    { type: "web_search_call", status: "completed", action: { type: "search", query: "football competitors", sources: [{url:"https://www.beta.in/",title:"Beta"}] } },
    { type: "message", content: [{ type: "output_text", text: JSON.stringify({competitors:[{name:"Beta",website:"https://beta.in/",rationale:"Same market",source_urls:["https://www.beta.in/"]}]}), annotations: [] }] }
  ] };
  let saved;
  await mockedFetch(async () => Response.json(response), async () => {
    const result = await adapter.invokeResearchOpenAI(adapter.prepareDiscoveryRequest("Target","football",null),"fixture",async snapshot => { saved = snapshot; });
    assert.equal(saved.output[1].content[0].text, response.output[2].content[0].text);
    assert.deepEqual(adapter.normalizeDiscoveryResponse(saved), result.value);
    assert.equal(JSON.stringify(saved).includes("not retained"),false);
  });
  response.output[2].content[0].text="not JSON";
  await mockedFetch(async () => Response.json(response), async () => {
    await assert.rejects(adapter.invokeResearchOpenAI(adapter.prepareDiscoveryRequest("Target","football",null),"fixture",async snapshot => { saved=snapshot; }),{code:"invalid_ai_response"});
    assert.equal(saved.output[1].content[0].text,"not JSON");
  });
}));
