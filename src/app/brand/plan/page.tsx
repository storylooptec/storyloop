import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { benchmarkMix, campaignIsReadOnly, creatorBudget, DELIVERABLE_LABELS, inr, readCampaignBrief, type BriefClaim } from "@/brand/planning";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";
import { approveCampaignBriefAction, generateCampaignBriefAction, saveCampaignBriefAction } from "./actions";

type Props = { searchParams: Promise<{ campaign?: string; error?: string; generated?: string; approved?: string; saved?: string }> };
type Evidence = { id: string; competitor_name: string; source_title: string; source_url: string; source_snippet: string; observed_at: string; evidence_kind: string };
const customerKinds = ["reddit_excerpt", "amazon_review"];
function errorText(value?: string) {
  const messages: Record<string, string> = {
    no_evidence: "Confirm competitors and collect their evidence before generating a brief.", provider: "Brief generation is not configured in this environment.",
    provider_disabled: "AI generation is currently paused. You can continue editing your saved brief.",
    limit: "This campaign has reached its generation limit. Please try again later.", quota_exceeded: "This campaign has reached its generation limit. Please try again later.",
    provider_rate_limited: "The AI provider is busy. Please try again later.", provider_limit: "The AI provider is busy. Please try again later.",
    generation: "The provider did not return a usable brief. Your existing work is saved.",
    invalid_citations: "The provider’s draft did not have valid citations. Your existing work is saved.",
    invalid_structured_output: "The provider’s draft was incomplete. Your existing work is saved.",
    submission_unknown: "The provider has not confirmed this request. It will not be retried automatically; check API Health before starting another generation.",
    save: "Your changes could not be saved. Please retry.", no_plan: "Generate a draft brief before approving it.",
    conflict: "This brief changed in another session. The latest saved version is shown below; review it before editing again.",
    citations: "Each nonempty hypothesis needs valid sources. Pain-area hypotheses need Reddit or Amazon review evidence. Check the field lengths too.",
    read_only: "This campaign has launched or closed. Its approved plan is read-only.",
    operation_in_progress: "A generation is already running for this campaign. Refresh in a moment.",
  };
  return value ? messages[value] ?? "Generation is temporarily unavailable. Your saved brief is safe; check API Health for details." : "";
}
function ClaimFields({ claim, kind, evidence, optional = false }: { claim: BriefClaim; kind: "pain_areas" | "usp_hypotheses"; evidence: Evidence[]; optional?: boolean }) {
  const options = kind === "pain_areas" ? evidence.filter((row) => customerKinds.includes(row.evidence_kind)) : evidence;
  return <fieldset style={{ margin: "14px 0", padding: 14, border: "1px solid var(--border, #dde3ed)", borderRadius: 12 }}>
    <legend>{optional ? "Add a hypothesis (optional)" : "Evidence-linked hypothesis"}</legend>
    <input type="hidden" name={`${kind}_id`} value={claim.id} />
    <label className={styles.field}>Statement<textarea name={`claim_${claim.id}`} defaultValue={claim.statement} rows={2} maxLength={700} placeholder="What the evidence suggests, and what still needs validation" /></label>
    <details style={{ marginTop: 10 }}>
      <summary>Choose sources · {claim.evidence_ids.length} linked</summary>
      <div className={styles.formWrap} style={{ marginTop: 10 }}>
        {options.length ? options.map((row) => <label key={row.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <input type="checkbox" name={`evidence_${claim.id}`} value={row.id} defaultChecked={claim.evidence_ids.includes(row.id)} />
          <span>{row.source_title} <span className={styles.muted}>· {row.evidence_kind.replaceAll("_", " ")} · {new Date(row.observed_at).toLocaleDateString("en-IN")}</span></span>
        </label>) : <p className={styles.muted}>Collect customer-source observations in Competitors before adding a pain-area hypothesis.</p>}
      </div>
    </details>
    {!optional ? <small className={styles.muted}>Clear the statement to remove this hypothesis. Its source links stay attached when other hypotheses change.</small> : null}
  </fieldset>;
}

export default async function BrandPlanPage({ searchParams }: Props) {
  const [{ campaign: campaignId, error, generated, approved, saved }, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const { data: campaigns, error: campaignsError } = await supabase.from("brand_campaigns")
    .select("id,title,brand_name,promoted_item,objective,deliverables,status,requested_budget_cents")
    .eq("company_id", context.companyId).order("updated_at", { ascending: false });
  const campaign = campaignId ? campaigns?.find((item) => item.id === campaignId) : campaigns?.[0];
  if (campaignId && !campaign && !campaignsError) notFound();
  const [planResult, scansResult, competitorsResult, selectionsResult, benchmarkResult] = campaign ? await Promise.all([
    supabase.from("brand_campaign_plans").select("brief,approval_state,revision").eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle(),
    supabase.from("brand_competitor_scans").select("id").eq("campaign_id", campaign.id).eq("company_id", context.companyId).eq("status", "succeeded"),
    supabase.from("brand_competitors").select("id").eq("campaign_id", campaign.id).eq("company_id", context.companyId).eq("status", "confirmed"),
    supabase.from("brand_campaign_creator_selections").select("id,creator_name_snapshot,deliverable_type,quantity,unit_rate_cents,currency").eq("campaign_id", campaign.id).eq("company_id", context.companyId),
    supabase.rpc("get_brand_campaign_benchmarks", { target_campaign_id: campaign.id }),
  ]) : [null, null, null, null, null];
  const plan = planResult?.data;
  const brief = readCampaignBrief(plan?.brief);
  const revision = plan?.revision ?? 0;
  const readOnly = campaign ? campaignIsReadOnly(campaign.status) : false;
  const selections = selectionsResult?.data ?? [];
  const budget = creatorBudget(selections, campaign?.requested_budget_cents ?? null);
  const history = benchmarkResult?.data ?? [];
  const mix = benchmarkMix(selections, history);
  let evidence: Evidence[] = [];
  let evidenceFailed = false;
  const scanIds = (scansResult?.data ?? []).map((row) => row.id);
  const confirmedIds = (competitorsResult?.data ?? []).map((row) => row.id);
  if (campaign && scanIds.length && confirmedIds.length) {
    const selected = [...new Set([...(brief?.pain_areas ?? []), ...(brief?.usp_hypotheses ?? [])].flatMap((claim) => claim.evidence_ids))];
    const baseQuery = () => supabase.from("brand_competitor_observations")
      .select("id,competitor_name,source_title,source_url,source_snippet,observed_at,evidence_kind")
      .eq("company_id", context.companyId).in("scan_id", scanIds).in("competitor_id", confirmedIds);
    const [recent, cited] = await Promise.all([
      baseQuery().order("observed_at", { ascending: false }).limit(20),
      selected.length ? baseQuery().in("id", selected) : Promise.resolve({ data: [], error: null }),
    ]);
    evidenceFailed = Boolean(recent.error || cited.error);
    evidence = [...new Map([...(recent.data ?? []), ...(cited.data ?? [])].map((row) => [row.id, row])).values()];
  }
  const loadFailed = Boolean(campaignsError || planResult?.error || scansResult?.error || competitorsResult?.error || selectionsResult?.error || benchmarkResult?.error || evidenceFailed);

  return <BrandShell active="Plan" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Campaign workspace · Plan & creators</p>
      <h1 className={styles.appTitle}>A clear brief. A considered budget.</h1>
      <p className={styles.appCopy}>Review the evidence, approve your direction, then choose creators at Storyloop’s published rates.</p>
    </header>
    {loadFailed ? <p className={styles.error} role="alert">Some planning data could not be loaded. Refresh before making changes.</p> : null}
    {errorText(error) ? <p className={styles.error} role="alert">{errorText(error)}</p> : null}
    {generated ? <p className={styles.evidenceNote} role="status">Draft generated. Review its hypotheses and sources before approval.</p> : null}
    {saved ? <p className={styles.evidenceNote} role="status">Draft saved. Any previous creative approval has been cleared.</p> : null}
    {approved ? <p className={styles.evidenceNote} role="status">Your current edits are saved and approved. Choose creators in Discover, or continue to Create.</p> : null}
    {campaigns?.length ? <form method="get" className={styles.formActions}>
      <label className={styles.field}>Campaign<select name="campaign" defaultValue={campaign?.id}>{campaigns.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
      <button type="submit" className={styles.secondaryButton}>Open campaign</button>
    </form> : null}
    {campaign ? <>
      {readOnly ? <p className={styles.evidenceNote}>This campaign is {campaign.status}. Its plan and creator rates are preserved for reporting.</p> : null}
      <section className={styles.homeGrid} style={{ marginTop: 18 }}>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Campaign direction</p><h2 style={{ margin: 0, fontSize: 20 }}>{campaign.title}</h2>
          <p className={styles.muted}>{campaign.brand_name} · {campaign.promoted_item} · {campaign.objective}</p>
          <p className={styles.muted}>{campaign.deliverables.map((type) => DELIVERABLE_LABELS[type] ?? type).join(" · ")}</p>
          <Link href={`/brand/campaigns/${campaign.id}/competitors`} className={styles.secondaryButton}>Review competitor evidence</Link>
          <p className={styles.muted}>Only confirmed competitors feed this brief. Customer excerpts support hypotheses; they do not measure representative sentiment or market share.</p>
          {!readOnly && !loadFailed ? <form action={generateCampaignBriefAction} style={{ marginTop: 16 }}>
            <input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="request_id" value={randomUUID()} />
            <button className={styles.primaryButton} type="submit" disabled={!evidence.length}>{brief ? "Generate a new draft" : "Generate campaign brief"}</button>
            {brief ? <p className={styles.muted}>A new draft replaces this brief and clears approval. Existing creative drafts are kept for reference.</p> : null}
          </form> : null}
        </article>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Creator budget check</p>
          <div className={styles.campaignRow}><span>Requested budget</span><strong>{inr(campaign.requested_budget_cents)}</strong></div>
          <div className={styles.campaignRow}><span>Selected creator deliverables</span><strong>{selections.length ? inr(budget.totalCents) : "No creators selected"}</strong></div>
          {selections.length && budget.remainingCents !== null ? <div className={styles.campaignRow}><span>{budget.remainingCents < 0 ? "Over requested budget" : "Budget remaining"}</span><strong>{inr(Math.abs(budget.remainingCents))}</strong></div> : null}
          <p className={styles.muted}>Totals use quantity × saved Storyloop rate in INR. Media spend, taxes and any separately quoted usage rights are excluded.</p>
          {mix ? <><div className={styles.campaignRow}><span>Historical median for this mix</span><strong>{inr(mix.medianCents)}</strong></div><p className={styles.muted}>Historical middle range: {inr(mix.lowCents)}–{inr(mix.highCents)}. Based on completed campaigns with the same objective.</p></> : <p className={styles.muted}>A historical comparison appears when every selected format has at least 5 completed campaigns with the same objective.</p>}
          {history.map((row) => <small key={row.deliverable_type} className={styles.muted} style={{ display: "block" }}>{DELIVERABLE_LABELS[row.deliverable_type] ?? row.deliverable_type}: {row.campaign_count} completed campaigns · median booked unit rate {inr(Number(row.median_unit_rate_cents))}</small>)}
          <Link href={`/brand/discover?campaign=${campaign.id}`} className={styles.secondaryButton} style={{ marginTop: 12 }}>{selections.length ? "Review selected creators" : "Choose creators"} →</Link>
        </article>
      </section>
      {brief ? <section className={styles.panel} style={{ marginTop: 18 }}>
        <div className={styles.campaignRow}><div><p className={styles.eyebrow}>Your campaign brief</p><h2 style={{ margin: 0 }}>Review and refine</h2></div><span className={styles.statusPill}>{plan?.approval_state} · v{revision}</span></div>
        <form action={saveCampaignBriefAction} className={styles.formWrap} key={revision}>
          <input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="revision" value={revision} />
          <fieldset disabled={readOnly || loadFailed} style={{ padding: 0, margin: 0, border: 0 }}>
            <label className={styles.field}>Brief summary<textarea name="summary" defaultValue={brief.summary} rows={3} maxLength={1200} required /></label>
            <h3>Pain-area hypotheses</h3><p className={styles.muted}>Use customer-source excerpts and describe what still needs validation.</p>
            {brief.pain_areas.map((claim) => <ClaimFields key={claim.id} claim={claim} kind="pain_areas" evidence={evidence} />)}
            {!brief.pain_areas.length ? <p className={styles.muted}>No supported customer pain hypotheses yet.</p> : null}
            {!readOnly && brief.pain_areas.length < 8 ? <details><summary>Add a pain-area hypothesis</summary><ClaimFields claim={{ id: randomUUID(), statement: "", evidence_ids: [] }} kind="pain_areas" evidence={evidence} optional /></details> : null}
            <h3>USP hypotheses</h3>
            {brief.usp_hypotheses.map((claim) => <ClaimFields key={claim.id} claim={claim} kind="usp_hypotheses" evidence={evidence} />)}
            {!readOnly && brief.usp_hypotheses.length < 8 ? <details><summary>Add a positioning hypothesis</summary><ClaimFields claim={{ id: randomUUID(), statement: "", evidence_ids: [] }} kind="usp_hypotheses" evidence={evidence} optional /></details> : null}
            <label className={styles.field} style={{ marginTop: 18 }}>Recommended angle<textarea name="recommended_angle" defaultValue={brief.recommended_angle} rows={3} maxLength={700} required /></label>
            <label className={styles.field}>Creator brief<textarea name="creator_brief" defaultValue={brief.creator_brief} rows={4} maxLength={1200} required /></label>
            <div className={styles.formGrid}>
              <label className={styles.field}>Must include · one per line<textarea name="must_include" defaultValue={brief.must_include.join("\n")} rows={4} maxLength={3612} /></label>
              <label className={styles.field}>Must avoid · one per line<textarea name="must_avoid" defaultValue={brief.must_avoid.join("\n")} rows={4} maxLength={3612} /></label>
            </div>
            {!readOnly ? <div className={styles.formActions}><button type="submit" className={styles.secondaryButton}>Save draft</button><button type="submit" formAction={approveCampaignBriefAction} className={styles.primaryButton}>Save & approve brief →</button></div> : null}
          </fieldset>
        </form>
        {plan?.approval_state === "approved" ? <div className={styles.formActions}><Link href={`/brand/discover?campaign=${campaign.id}`} className={styles.secondaryButton}>Choose creators →</Link><Link href={`/brand/create?campaign=${campaign.id}`} className={styles.primaryButton}>Continue to Create →</Link></div> : null}
      </section> : <section className={styles.panel} style={{ marginTop: 18 }}><p className={styles.muted}>{evidence.length ? "Generate your first brief from the saved evidence above." : "Confirm competitors and collect evidence to build your campaign brief."}</p></section>}
      <section className={styles.panel} style={{ marginTop: 18 }}><p className={styles.eyebrow}>Evidence library · {evidence.length} observations shown</p>
        {evidence.length ? <div className={styles.campaignList}>{evidence.map((row) => <div className={styles.campaignRow} key={row.id}>
          <div><strong>{row.source_title}</strong><p className={styles.muted}>{row.source_snippet}</p><small className={styles.muted}>{row.evidence_kind.replaceAll("_", " ")} · observed {new Date(row.observed_at).toLocaleDateString("en-IN")}</small></div>
          {/^https?:\/\//i.test(row.source_url) ? <a href={row.source_url} target="_blank" rel="noreferrer" className={styles.textButton}>Source ↗</a> : null}
        </div>)}</div> : <div className={styles.emptyState}>No confirmed competitor evidence yet.</div>}
      </section>
    </> : <section className={styles.panel}><p className={styles.emptyState}>Create a campaign to start planning.</p><Link href="/brand/campaigns/new" className={styles.primaryButton}>Start a campaign</Link></section>}
  </BrandShell>;
}
