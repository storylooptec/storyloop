import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkMix, briefCitationsAreValid, campaignIsReadOnly, creatorBudget, readCampaignBrief, readEditedBrief } from "../src/brand/planning.ts";

const sourceIds = new Set(["source-A", "source-B"]);
function editForm() {
  const form = new FormData();
  for (const [name, value] of Object.entries({ summary: "Launch brief", recommended_angle: "Reliable design", creator_brief: "Show a demo", must_include: "Brand name", must_avoid: "Unsupported claims" })) form.set(name, value);
  return form;
}
test("reordered claims keep their own evidence and deleting a claim does not shift citations", () => {
  const form = editForm();
  form.append("pain_areas_id", "second"); form.append("pain_areas_id", "first");
  form.set("claim_first", "First pain"); form.append("evidence_first", "source-A");
  form.set("claim_second", "Second pain"); form.append("evidence_second", "source-B");
  assert.deepEqual(readEditedBrief(form, sourceIds)?.pain_areas.map((c) => [c.id, c.evidence_ids]), [["second", ["source-B"]], ["first", ["source-A"]]]);
  form.set("claim_first", "");
  assert.deepEqual(readEditedBrief(form, sourceIds)?.pain_areas.map((c) => c.evidence_ids), [["source-B"]]);
});
test("claims cannot cite another campaign, omit evidence, or duplicate field IDs", () => {
  const form = editForm(); form.append("usp_hypotheses_id", "claim-1"); form.set("claim_claim-1", "Positioning hypothesis");
  assert.equal(readEditedBrief(form, sourceIds), null);
  form.append("evidence_claim-1", "foreign-source"); assert.equal(readEditedBrief(form, sourceIds), null);
  form.set("evidence_claim-1", "source-A"); assert.ok(readEditedBrief(form, sourceIds));
  form.append("usp_hypotheses_id", "claim-1"); assert.equal(readEditedBrief(form, sourceIds), null);
});
test("legacy briefs get deterministic claim IDs and malformed provider fields are rejected", () => {
  const brief = { summary: "Launch", recommended_angle: "Demo", creator_brief: "Shoot", pain_areas: [{ statement: "Question", evidence_ids: ["source-A"] }], usp_hypotheses: [], must_include: [], must_avoid: [] };
  assert.equal(readCampaignBrief(brief)?.pain_areas[0]?.id, "pain_areas-0");
  assert.equal(readCampaignBrief({ ...brief, must_include: [24] }), null);
  assert.equal(briefCitationsAreValid(readCampaignBrief(brief), new Set()), false);
});
test("creator totals use INR minor units, quantity, and exact selected snapshots", () => {
  const selections = [{ deliverable_type: "instagram_reel", quantity: 3, unit_rate_cents: 125050, currency: "INR" }, { deliverable_type: "static_post", quantity: 2, unit_rate_cents: 50000, currency: "INR" }];
  assert.deepEqual(creatorBudget(selections, 450000), { totalCents: 475150, quantities: { instagram_reel: 3, static_post: 2 }, remainingCents: -25150 });
  assert.throws(() => creatorBudget([{ ...selections[0], quantity: 1.5 }], null));
  assert.throws(() => creatorBudget([{ ...selections[0], currency: "USD" }], null));
});
test("benchmark comparison refuses a small cohort or incomplete selected mix", () => {
  const selections = [{ deliverable_type: "instagram_reel", quantity: 2, unit_rate_cents: 100000, currency: "INR" }];
  const row = { deliverable_type: "instagram_reel", campaign_count: 4, median_unit_rate_cents: 110000, p25_unit_rate_cents: 90000, p75_unit_rate_cents: 130000 };
  assert.equal(benchmarkMix(selections, [row]), null);
  assert.deepEqual(benchmarkMix(selections, [{ ...row, campaign_count: 5 }]), { medianCents: 220000, lowCents: 180000, highCents: 260000 });
  assert.equal(benchmarkMix([...selections, { ...selections[0], deliverable_type: "static_post" }], [{ ...row, campaign_count: 5 }]), null);
  assert.equal(benchmarkMix([], [{ ...row, campaign_count: 5 }]), null);
});
test("launched and closed campaigns are immutable", () => {
  for (const status of ["active", "completed", "archived"]) assert.equal(campaignIsReadOnly(status), true);
  assert.equal(campaignIsReadOnly("ready_for_desk"), false);
});

test("pain-area claims need customer evidence, not an official product page", () => {
  const form = editForm();
  form.append("pain_areas_id", "pain-one"); form.set("claim_pain-one", "A customer pain hypothesis");
  form.append("evidence_pain-one", "source-A");
  assert.equal(readEditedBrief(form, sourceIds, new Set(["source-B"])), null);
  assert.ok(readEditedBrief(form, sourceIds, new Set(["source-A"])));
});
