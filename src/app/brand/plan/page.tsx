import Link from "next/link";
import { notFound } from "next/navigation";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import styles from "../brand.module.css";
import { approveCampaignBriefAction, generateCampaignBriefAction, saveCampaignBriefAction } from "./actions";

type Claim = { statement: string; evidence_ids: string[] };
type Brief = {
  summary: string;
  pain_areas: Claim[];
  usp_hypotheses: Claim[];
  recommended_angle: string;
  creator_brief: string;
  must_include: string[];
  must_avoid: string[];
};
type Props = { searchParams: Promise<{ campaign?: string; error?: string; generated?: string; approved?: string; saved?: string }> };

function readBrief(value: Json | null | undefined): Brief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, Json>;
  if (typeof data.summary !== "string" || !Array.isArray(data.pain_areas) || !Array.isArray(data.usp_hypotheses)) return null;
  return data as unknown as Brief;
}
function lines(value?: string[]) { return value?.join("\n") ?? ""; }
function money(cents: number | null) {
  return cents === null ? "Not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}
function errorText(value?: string) {
  const messages: Record<string,string> = {
    no_evidence: "Run this campaign’s competitor scan before generating a brief.",
    provider: "OpenAI is not configured in this environment. No request was sent.",
    limit: "This campaign reached the app’s brief generation limit. Try again in the next hour.",
    provider_limit: "The AI provider rate limited this request. Try again later.",
    generation: "The brief could not be generated with valid source citations. Try again after reviewing the evidence.",
    save: "The plan could not be saved. Please retry.",
    no_plan: "Generate a brief before saving or approving it.",
  };
  return value ? messages[value] ?? "" : "";
}

export default async function BrandPlanPage({ searchParams }: Props) {
  const [{ campaign: campaignId, error, generated, approved, saved }, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase.from("brand_campaigns")
    .select("id,title,brand_name,promoted_item,objective,deliverables,status,requested_budget_cents")
    .eq("company_id", context.companyId).order("updated_at", { ascending: false });
  const campaign = campaignId ? campaigns?.find((item) => item.id === campaignId) : campaigns?.[0];
  if (campaignId && !campaign) notFound();

  let brief: Brief | null = null;
  let approvalState = "draft";
  let evidence: Array<{ id: string; competitor_name: string; source_title: string; source_url: string; source_snippet: string; observed_at: string }> = [];
  if (campaign) {
    const [{ data: plan }, { data: scans }] = await Promise.all([
      supabase.from("brand_campaign_plans").select("brief,approval_state").eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle(),
      supabase.from("brand_competitor_scans").select("id").eq("campaign_id", campaign.id).eq("company_id", context.companyId),
    ]);
    brief = readBrief(plan?.brief);
    approvalState = plan?.approval_state ?? "draft";
    const scanIds = (scans ?? []).map((scan) => scan.id);
    if (scanIds.length) {
      const { data } = await supabase.from("brand_competitor_observations")
        .select("id,competitor_name,source_title,source_url,source_snippet,observed_at")
        .eq("company_id", context.companyId).in("scan_id", scanIds)
        .order("observed_at", { ascending: false }).limit(20);
      evidence = data ?? [];
    }
  }
  const byId = new Map(evidence.map((item) => [item.id, item]));

  return (
    <BrandShell active="Plan" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign workspace · Step 3</p>
        <h1 className={styles.appTitle}>Turn evidence into an approved brief</h1>
        <p className={styles.appCopy}>The brief draws only on this campaign’s saved competitor observations. Search signals are hypotheses, not verified customer complaints or competitor facts.</p>
      </header>
      {errorText(error) ? <p className={styles.error} role="alert">{errorText(error)}</p> : null}
      {generated ? <p className={styles.evidenceNote} role="status">A draft brief was generated. Review each citation and edit the fields before approval.</p> : null}
      {saved ? <p className={styles.evidenceNote} role="status">Your edits are saved as a draft.</p> : null}
      {approved ? <p className={styles.evidenceNote} role="status">Brief approved. The campaign is ready for Storyloop’s creator planning workflow.</p> : null}

      {campaign ? (
        <>
          <section className={styles.homeGrid} style={{ marginTop: 18 }}>
            <article className={styles.panel}>
              <p className={styles.eyebrow}>Campaign</p>
              <h2 style={{ margin: 0, fontSize: 19 }}>{campaign.title}</h2>
              <p className={styles.muted}>{campaign.brand_name} · {campaign.promoted_item} · {campaign.objective}</p>
              <p className={styles.muted}>Requested deliverables: {campaign.deliverables.join(", ") || "Not set"}</p>
              <div className={styles.campaignRow}><span>Requested budget</span><strong>{money(campaign.requested_budget_cents)}</strong></div>
              <p className={styles.muted}>Creator rates and Storyloop historical benchmarks will be shown when the consented creator catalog and campaign history are available. The budget check will compare the requested amount with the selected creator mix.</p>
              <Link href={"/brand/campaigns/" + campaign.id + "/competitors"} className={styles.secondaryButton}>Review competitor evidence</Link>
            </article>
            <article className={styles.panel}>
              <p className={styles.eyebrow}>Evidence attached to this campaign</p>
              {evidence.length ? (
                <div className={styles.campaignList}>
                  {evidence.map((item) => (
                    <div className={styles.campaignRow} key={item.id}>
                      <div><strong>{item.competitor_name}</strong><div className={styles.muted}>{item.source_snippet || item.source_title}</div><small className={styles.muted}>Observed {new Date(item.observed_at).toLocaleDateString("en-IN")}</small></div>
                      <a href={item.source_url} target="_blank" rel="noreferrer" className={styles.textButton}>Source ↗</a>
                    </div>
                  ))}
                </div>
              ) : <div className={styles.emptyState}>Run this campaign’s competitor scan first.</div>}
              {evidence.length ? (
                <form action={generateCampaignBriefAction} style={{ marginTop: 16 }}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <button className={styles.primaryButton} type="submit">{brief ? "Regenerate draft brief" : "Generate evidence-backed brief"}</button>
                </form>
              ) : null}
            </article>
          </section>
          {brief ? (
            <section className={styles.panel} style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div><p className={styles.eyebrow}>Editable campaign brief</p><h2 style={{ margin: 0, fontSize: 19 }}>Review and refine</h2></div>
                <span className={styles.statusPill}>{approvalState}</span>
              </div>
              <form action={saveCampaignBriefAction} className={styles.formWrap}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <label className={styles.field}>Brief summary<textarea name="summary" defaultValue={brief.summary} rows={3} /></label>
                <label className={styles.field}>Pain area hypotheses · one per line<textarea name="pain_areas" defaultValue={lines(brief.pain_areas.map((item) => item.statement))} rows={4} /></label>
                <div className={styles.campaignList}>
                  {brief.pain_areas.map((claim, index) => (
                    <div className={styles.campaignRow} key={"pain-" + index}><strong>Hypothesis {index + 1}</strong><span>{claim.evidence_ids.map((id) => byId.get(id)?.source_title ?? "Source unavailable").join(" · ") || "No linked citation"}</span></div>
                  ))}
                </div>
                <label className={styles.field}>USP hypotheses · one per line<textarea name="usp_hypotheses" defaultValue={lines(brief.usp_hypotheses.map((item) => item.statement))} rows={4} /></label>
                <div className={styles.campaignList}>
                  {brief.usp_hypotheses.map((claim, index) => (
                    <div className={styles.campaignRow} key={"usp-" + index}><strong>Hypothesis {index + 1}</strong><span>{claim.evidence_ids.map((id) => byId.get(id)?.source_title ?? "Source unavailable").join(" · ") || "No linked citation"}</span></div>
                  ))}
                </div>
                <label className={styles.field}>Recommended campaign angle<textarea name="recommended_angle" defaultValue={brief.recommended_angle} rows={3} /></label>
                <label className={styles.field}>Creator brief<textarea name="creator_brief" defaultValue={brief.creator_brief} rows={4} /></label>
                <div className={styles.formGrid}>
                  <label className={styles.field}>Must include · one per line<textarea name="must_include" defaultValue={lines(brief.must_include)} rows={4} /></label>
                  <label className={styles.field}>Must avoid · one per line<textarea name="must_avoid" defaultValue={lines(brief.must_avoid)} rows={4} /></label>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.secondaryButton}>Save edits</button>
                </div>
              </form>
              <form action={approveCampaignBriefAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <button type="submit" className={styles.primaryButton}>Approve brief →</button>
              </form>
            </section>
          ) : null}
        </>
      ) : (
        <section className={styles.panel}><div className={styles.emptyState}>Create a campaign to start planning.</div><Link href="/brand/campaigns/new" className={styles.primaryButton}>Create campaign</Link></section>
      )}
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <p className={styles.eyebrow}>Creator selection and budget check</p>
        <p className={styles.muted}>The next stage will select creators from Discover, total their Storyloop rates, and compare the requested mix with benchmarks computed from Storyloop’s own campaign history. No creator rates or benchmarks are estimated in this view.</p>
        <Link href="/brand/discover" className={styles.secondaryButton}>Open Discover →</Link>
      </section>
    </BrandShell>
  );
}
