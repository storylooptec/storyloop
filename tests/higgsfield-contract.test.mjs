import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Load the provider adapter with its server-only boundary and shared error class substituted;
// fetch is mocked in every request test, so this suite cannot call or spend at the provider.
const path = new URL("../src/lib/providers/higgsfield.ts", import.meta.url);
const creativeUrl = new URL("../src/brand/creative.ts", import.meta.url).href;
const source = (await readFile(path, "utf8")).replace('import "server-only";', "")
  .replace('from "@/brand/creative"', `from ${JSON.stringify(creativeUrl)}`)
  .replace('import { ProviderError } from "@/lib/providers/runtime";', 'class ProviderError extends Error { constructor(public code: string) { super(code); } }');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const provider = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const requestId = "11111111-1111-4111-8111-111111111111";
const statusUrl = `https://api.higgsfield.ai/requests/${requestId}/status`;

async function withMockFetch(callback, run) {
  const original = globalThis.fetch;
  const old = process.env.HIGGSFIELD_API_KEY;
  process.env.HIGGSFIELD_API_KEY = "test-key:test-secret";
  globalThis.fetch = callback;
  try { await run(); } finally { globalThis.fetch = original; if (old === undefined) delete process.env.HIGGSFIELD_API_KEY; else process.env.HIGGSFIELD_API_KEY = old; }
}

test("Higgsfield submission uses exact endpoint, payload and idempotency key", async () => {
  const payload = provider.previewPayload("image", "A product against a blue background");
  let called = 0;
  await withMockFetch(async (url, options) => {
    called += 1;
    assert.equal(url, "https://api.higgsfield.ai/marketing-studio/image");
    assert.equal(options.headers.Authorization, "Key test-key:test-secret");
    assert.equal(options.headers["Idempotency-Key"], "same-stored-key");
    assert.equal(options.body, JSON.stringify(payload));
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify({ request_id: requestId, status_url: statusUrl, status: "queued" }));
  }, async () => assert.deepEqual(await provider.submitPreview("marketing-studio/image", payload, "same-stored-key"), { requestId, statusUrl }));
  assert.equal(called, 1);
});

test("an ambiguous timeout is never silently retried", async () => {
  let called = 0;
  await withMockFetch(async () => { called += 1; throw new Error("socket reset after request"); }, async () => {
    await assert.rejects(provider.submitPreview("marketing-studio/image", { prompt: "Exact request" }, "fixed-key"), { code: "submission_unknown" });
  });
  assert.equal(called, 1);
});

test("non-provider status hosts are rejected before credentials or requests leave", async () => {
  let called = 0;
  await withMockFetch(async () => { called += 1; throw new Error("must not fetch"); }, async () => {
    await assert.rejects(provider.getPreviewStatus(statusUrl.replace("api.higgsfield.ai", "evil.example"), requestId), { code: "provider_invalid_status_url" });
  });
  assert.equal(called, 0);
});

test("creator references cannot enter unsupported text-to-video model", () => {
  assert.throws(() => provider.previewPayload("video", "Prompt", "https://example.com/photo"), { code: "creator_video_unsupported" });
  assert.deepEqual(provider.previewPayload("video", "Product scene"), { prompt: "Product scene", duration: 5, sound: "off", aspect_ratio: "9:16", multi_shots: false, cfg_scale: 0.5 });
});

test("invalid or missing quote values cannot authorize generation", async () => {
  for (const usd of ["unknown", null, "", undefined, -1]) {
    await withMockFetch(async () => new Response(JSON.stringify({ usd, credits: "1" })), async () => {
      await assert.rejects(provider.estimatePreview("image", { prompt: "Scene" }), { code: "provider_invalid_estimate" });
    });
  }
});
