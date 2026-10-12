/** Campaign metrics are UTC daily deltas. Upserting a source/day replaces that day's values. */
export const metricPlatforms = ["instagram", "youtube", "tiktok", "facebook", "linkedin", "other"] as const;
export const metricKeys = ["views", "impressions", "engagements", "clicks", "conversions", "spend_cents", "revenue_cents"] as const;
export type MetricKey = typeof metricKeys[number];
export type MetricValues = Record<MetricKey, number | null>;
export type MetricTotal = { value: number | null; reported: number; total: number };

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function dateRange(from?: string, to?: string, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  const start = from && isIsoDate(from) ? from : defaultFrom;
  const end = to && isIsoDate(to) ? to : today;
  return { from: start <= end ? start : end, to: end, until: new Date(Date.parse(end) + 86_400_000).toISOString() };
}

/** Missing measurements stay missing. Ratios require complete paired measurement coverage. */
export function summarizeMetrics(rows: MetricValues[]) {
  const totals = Object.fromEntries(metricKeys.map((key) => {
    const measured = rows.map((row) => row[key]).filter((value): value is number => value !== null);
    return [key, { value: measured.length ? measured.reduce((sum, value) => sum + value, 0) : null, reported: measured.length, total: rows.length }];
  })) as Record<MetricKey, MetricTotal>;
  function ratio(numerator: MetricKey, denominator: MetricKey, scale: number) {
    const num = totals[numerator];
    const den = totals[denominator];
    return rows.length > 0 && num.reported === rows.length && den.reported === rows.length && num.value !== null && den.value !== null && den.value > 0
      ? num.value / den.value * scale : null;
  }
  return { totals, ctr: ratio("clicks", "impressions", 100), cpc: ratio("spend_cents", "clicks", 0.01), cpm: ratio("spend_cents", "impressions", 10), roas: ratio("revenue_cents", "spend_cents", 1) };
}

export function parseMetricValue(value: FormDataEntryValue | null, money = false): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!(money ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(raw)) throw new Error("Use non-negative numbers; money may have at most two decimal places.");
  const parsed = money ? Math.round(Number(raw) * 100) : Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > (money ? 100_000_000_000 : 1_000_000_000)) throw new Error("Metric value is too large.");
  return parsed;
}
