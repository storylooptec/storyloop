/** Pure planning rules shared by the forms, server actions, and verification. */
export type BriefClaim = { id: string; statement: string; evidence_ids: string[] };
export type CampaignBrief = {
  summary: string;
  pain_areas: BriefClaim[];
  usp_hypotheses: BriefClaim[];
  recommended_angle: string;
  creator_brief: string;
  must_include: string[];
  must_avoid: string[];
};
export const DELIVERABLE_LABELS: Record<string, string> = {
  instagram_reel: "Instagram Reel", instagram_story: "Instagram Story",
  youtube_short: "YouTube Short", static_post: "Static post",
};
export function campaignIsReadOnly(status: string): boolean {
  return ["active", "completed", "archived"].includes(status);
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
const fieldId = /^[a-zA-Z0-9_-]{1,80}$/;

/** Legacy briefs receive deterministic field IDs. Once saved, their IDs are persisted. */
export function readCampaignBrief(value: unknown): CampaignBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (!boundedText(item.summary, 1200) || !boundedText(item.recommended_angle, 700) || !boundedText(item.creator_brief, 1200)) return null;
  const ids = new Set<string>();
  const claims = (name: "pain_areas" | "usp_hypotheses"): BriefClaim[] | null => {
    const rows = item[name];
    if (!Array.isArray(rows) || rows.length > 8) return null;
    const result: BriefClaim[] = [];
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const claim = row as Record<string, unknown>;
      const id = typeof claim.id === "string" ? claim.id : `${name}-${index}`;
      if (!fieldId.test(id) || ids.has(id) || !boundedText(claim.statement, 700)
        || !Array.isArray(claim.evidence_ids) || claim.evidence_ids.length < 1 || claim.evidence_ids.length > 20
        || !claim.evidence_ids.every((v) => typeof v === "string" && v.length > 0)) return null;
      ids.add(id);
      result.push({ id, statement: claim.statement, evidence_ids: [...new Set(claim.evidence_ids as string[])] });
    }
    return result;
  };
  const pain_areas = claims("pain_areas");
  const usp_hypotheses = claims("usp_hypotheses");
  const strings = (name: string): string[] | null => Array.isArray(item[name]) && item[name].length <= 12
    && item[name].every((s) => boundedText(s, 300)) ? item[name] as string[] : null;
  const must_include = strings("must_include");
  const must_avoid = strings("must_avoid");
  if (!pain_areas || !usp_hypotheses || !must_include || !must_avoid) return null;
  return { summary: item.summary, pain_areas, usp_hypotheses, recommended_angle: item.recommended_angle,
    creator_brief: item.creator_brief, must_include, must_avoid };
}

export function briefCitationsAreValid(brief: CampaignBrief, validEvidenceIds: ReadonlySet<string>, customerEvidenceIds?: ReadonlySet<string>): boolean {
  return [...brief.pain_areas, ...brief.usp_hypotheses].every((claim) =>
    claim.evidence_ids.length > 0 && claim.evidence_ids.every((id) => validEvidenceIds.has(id)))
    && (!customerEvidenceIds || brief.pain_areas.every((claim) => claim.evidence_ids.every((id) => customerEvidenceIds.has(id))));
}

/** Each claim has its own statement and citation fields; ordering never determines citation ownership. */
export function readEditedBrief(form: FormData, validEvidenceIds: ReadonlySet<string>, customerEvidenceIds?: ReadonlySet<string>): CampaignBrief | null {
  const string = (name: string) => String(form.get(name) ?? "").trim();
  const claims = (name: string) => {
    const ids = form.getAll(`${name}_id`).map(String);
    if (ids.length > 9 || new Set(ids).size !== ids.length || ids.some((id) => !fieldId.test(id))) return null;
    return ids.flatMap((id) => {
      const statement = string(`claim_${id}`);
      if (!statement) return [];
      return [{ id, statement, evidence_ids: form.getAll(`evidence_${id}`).map(String) }];
    });
  };
  const pain_areas = claims("pain_areas"), usp_hypotheses = claims("usp_hypotheses");
  if (!pain_areas || !usp_hypotheses) return null;
  const lines = (name: string) => string(name).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const brief = readCampaignBrief({ summary: string("summary"), pain_areas, usp_hypotheses,
    recommended_angle: string("recommended_angle"), creator_brief: string("creator_brief"),
    must_include: lines("must_include"), must_avoid: lines("must_avoid") });
  return brief && briefCitationsAreValid(brief, validEvidenceIds, customerEvidenceIds) ? brief : null;
}

export type CreatorSelection = { deliverable_type: string; quantity: number; unit_rate_cents: number; currency: string };
export type CampaignBenchmark = { deliverable_type: string; campaign_count: number; median_unit_rate_cents: number; p25_unit_rate_cents: number; p75_unit_rate_cents: number };
export function creatorBudget(selections: CreatorSelection[], requestedBudgetCents: number | null) {
  let totalCents = 0;
  const quantities: Record<string, number> = {};
  for (const selection of selections) {
    if (selection.currency !== "INR" || !Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 100
      || !Number.isSafeInteger(selection.unit_rate_cents) || selection.unit_rate_cents < 0) throw new Error("Invalid creator rate snapshot");
    totalCents += selection.quantity * selection.unit_rate_cents;
    if (!Number.isSafeInteger(totalCents)) throw new Error("Creator total exceeds safe range");
    quantities[selection.deliverable_type] = (quantities[selection.deliverable_type] ?? 0) + selection.quantity;
  }
  return { totalCents, quantities, remainingCents: requestedBudgetCents === null ? null : requestedBudgetCents - totalCents };
}
/** No partial historical total: every selected deliverable needs a qualifying cohort. */
export function benchmarkMix(selections: CreatorSelection[], benchmarks: CampaignBenchmark[]) {
  const { quantities } = creatorBudget(selections, null);
  if (!Object.keys(quantities).length) return null;
  const byType = new Map(benchmarks.filter((b) => Number(b.campaign_count) >= 5).map((b) => [b.deliverable_type, b]));
  let medianCents = 0, lowCents = 0, highCents = 0;
  for (const [type, quantity] of Object.entries(quantities)) {
    const row = byType.get(type);
    if (!row) return null;
    const values = [row.median_unit_rate_cents, row.p25_unit_rate_cents, row.p75_unit_rate_cents].map(Number);
    if (!values.every((n) => Number.isFinite(n) && n >= 0)) return null;
    medianCents += quantity * values[0]; lowCents += quantity * values[1]; highCents += quantity * values[2];
  }
  return { medianCents: Math.round(medianCents), lowCents: Math.round(lowCents), highCents: Math.round(highCents) };
}
export function inr(cents: number | null): string {
  return cents === null ? "Not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(cents / 100);
}
