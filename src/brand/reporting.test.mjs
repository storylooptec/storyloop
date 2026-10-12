import assert from "node:assert/strict";
import test from "node:test";
import { dateRange, isIsoDate, parseMetricValue, summarizeMetrics } from "./reporting.ts";

const measured = { views: 900, impressions: 1000, engagements: 40, clicks: 20, conversions: 2, spend_cents: 10000, revenue_cents: 40000 };
test("reports calculate measured CTR, CPC, CPM and ROAS in INR", () => {
  const report = summarizeMetrics([measured, measured]);
  assert.equal(report.totals.spend_cents.value, 20000);
  assert.equal(report.ctr, 2);
  assert.equal(report.cpc, 5);
  assert.equal(report.cpm, 100);
  assert.equal(report.roas, 4);
});
test("missing and partial measurements do not turn into zero or misleading ratios", () => {
  assert.equal(summarizeMetrics([]).totals.views.value, null);
  const report = summarizeMetrics([measured, { ...measured, clicks: null, revenue_cents: null }]);
  assert.equal(report.ctr, null);
  assert.equal(report.cpc, null);
  assert.equal(report.roas, null);
  assert.equal(report.totals.clicks.reported, 1);
  assert.equal(report.totals.clicks.value, 20);
});
test("zero denominator is unavailable; measured zero numerator remains zero", () => {
  assert.equal(summarizeMetrics([{ ...measured, spend_cents: 0 }]).roas, null);
  assert.equal(summarizeMetrics([{ ...measured, clicks: 0 }]).ctr, 0);
  assert.equal(summarizeMetrics([{ ...measured, clicks: 0 }]).cpc, null);
});
test("metric values distinguish blank, zero, decimal money and reject unsafe values", () => {
  assert.equal(parseMetricValue(""), null);
  assert.equal(parseMetricValue("0"), 0);
  assert.equal(parseMetricValue("19.99", true), 1999);
  for (const value of ["-1", "1.2", "1e4", "NaN", "1000000001"]) assert.throws(() => parseMetricValue(value));
  assert.throws(() => parseMetricValue("0.001", true));
});
test("UTC date filters reject calendar overflow and end at exclusive next midnight", () => {
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.deepEqual(dateRange("2026-10-01", "2026-10-12"), { from: "2026-10-01", to: "2026-10-12", until: "2026-10-13T00:00:00.000Z" });
});
