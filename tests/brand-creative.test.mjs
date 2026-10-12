import assert from "node:assert/strict";
import test from "node:test";
import { readConcepts, previewConsentIsValid, previewRequestHash, safeProviderStatusUrl } from "../src/brand/creative.ts";

const campaignId = "11111111-1111-4111-8111-111111111111";
const creativeId = "22222222-2222-4222-8222-222222222222";
const creatorId = "33333333-3333-4333-8333-333333333333";
const concept = { angle: "A real angle", hook: "A hook", script: "A script", cta: "A call to action", format: "Reel" };

test("a creative needs exactly three complete, bounded concepts", () => {
  assert.equal(readConcepts({ concepts: [concept, concept, concept] }).length, 3);
  assert.equal(readConcepts({ concepts: [concept] }).length, 0);
  assert.equal(readConcepts({ concepts: [concept, concept, { ...concept, script: "" }] }).length, 0);
  assert.equal(readConcepts({ concepts: [concept, concept, { ...concept, hook: "x".repeat(501) }] }).length, 0);
  assert.equal(readConcepts(null).length, 0);
  assert.equal(readConcepts({ concepts: [concept, concept, { ...concept, cta: 10 }] }).length, 0);
});

test("consent fingerprint binds exact campaign, creative revision, prompt, creator, media and photo", () => {
  const base = { campaignId, creativeId, revision: 1, kind: "image", creatorId, prompt: "Exact approved prompt", referenceHash: "photo-sha256" };
  const original = previewRequestHash(base);
  for (const change of [
    { campaignId: creatorId }, { creativeId: creatorId }, { revision: 2 }, { kind: "video" },
    { creatorId: null }, { prompt: "Edited prompt" }, { referenceHash: "other-photo" },
  ]) assert.notEqual(previewRequestHash({ ...base, ...change }), original);
  assert.equal(previewRequestHash({ ...base }), original);
});

test("creator consent is invalid when expired, revoked, superseded or missing photo", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  const consent = { status: "approved", expires_at: "2026-10-13T12:00:00Z", creative_revision: 2, request_hash: "sha256", creator_id: creatorId, reference_object_key: "private/photo", reference_sha256: "photo-sha256" };
  assert.equal(previewConsentIsValid(consent, 2, now), true);
  assert.equal(previewConsentIsValid(consent, 3, now), false);
  assert.equal(previewConsentIsValid({ ...consent, status: "revoked" }, 2, now), false);
  assert.equal(previewConsentIsValid({ ...consent, expires_at: "2026-10-12T12:00:00Z" }, 2, now), false);
  assert.equal(previewConsentIsValid({ ...consent, reference_object_key: null }, 2, now), false);
  assert.equal(previewConsentIsValid({ ...consent, reference_sha256: null }, 2, now), false);
  assert.equal(previewConsentIsValid({ ...consent, expires_at: "invalid" }, 2, now), false);
});

test("provider authorization can only be sent to exact authenticated status URL", () => {
  const url = `https://api.higgsfield.ai/requests/${campaignId}/status`;
  assert.equal(safeProviderStatusUrl(url, campaignId), url);
  for (const invalid of [
    url.replace("https:", "http:"), url.replace("api.higgsfield.ai", "api.higgsfield.ai.attacker.example"),
    url.replace("api.higgsfield.ai", "attacker.example@api.higgsfield.ai"),
    `${url}?redirect=https://attacker.example`, `${url}#fragment`,
    url.replace(campaignId, creativeId), url.replace("/status", "/cancel"),
    "https://127.0.0.1/requests/foo/status",
  ]) assert.equal(safeProviderStatusUrl(invalid, campaignId), null);
});
