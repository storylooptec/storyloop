import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../../../brand.module.css";
import { ResearchPanel, type ResearchSnapshot, type ResearchScan } from "./research-panel";
import { SearchApiTestPanel } from "./searchapi-test-panel";

type Props = { params: Promise<{ campaignId: string }>; searchParams: Promise<{ cached?: string; error?: string; saved?: string; created?: string; scan?: string }> };
const when = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function errorMessage(code?: string) {
  if (!code) return "";
  if (code === "research_not_configured") return "Competitor research is not connected yet. Your campaign is saved. Ask your admin to complete the research connection.";
  if (code === "research_unavailable" || code === "evidence_save_failed") return "Research could not start or finish. Your campaign is saved. Please retry; if this continues, ask your admin to check the research connection.";
  if (/limit|quota|budget/.test(code)) return "This workspace's research or spending limit has been reached. Your saved evidence is still available. Admin can check the usage window.";
  if (/configured|disabled|auth_failed/.test(code)) return "Research is not available in this environment yet. Your campaign is saved; Admin can check the provider connection.";
  if (code === "scan_running") return "Research is already running. Open the active scan to follow its progress.";
  if (code === "campaign_read_only") return "Research is read-only after launch. Your approved evidence history remains available.";
  if (/selection|competitor_required|confirm_required/.test(code)) return "Select at least one verified competitor to continue. Your saved research is unchanged.";
  return "This research step could not finish. Your saved evidence is preserved. Try again later; Admin can check the research connection.";
}

export default async function CompetitorScanPage({ params, searchParams }: Props) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const context = await requireBrandContext();
  const db = await createServerSupabaseClient();
  const { data: campaign } = await db.from("brand_campaigns").select("id,title,brand_name,promoted_item,objective,deliverables,status")
    .eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (!campaign) notFound();
  const readOnly = ["active", "completed", "archived"].includes(campaign.status);
  const { data: scans, error: scanReadError } = await db.from("brand_competitor_scans").select("*")
    .eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(20);
  const activeScan = scans?.find((item) => ["queued", "running"].includes(item.status));
  const scan = (scans?.find((item) => item.id === query.scan) ?? activeScan ?? scans?.[0] ?? null) as ResearchScan | null;
  const [competitorResult, observationResult, taskResult] = scan ? await Promise.all([
    db.from("brand_competitors").select("*").eq("scan_id", scan.id).eq("company_id", context.companyId).order("created_at"),
    db.from("brand_competitor_observations").select("*").eq("scan_id", scan.id).eq("company_id", context.companyId).order("observed_at", { ascending: false }),
    db.from("brand_research_tasks").select("id,kind,status,error_code,next_attempt_at").eq("scan_id", scan.id).eq("company_id", context.companyId).order("created_at"),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const initial: ResearchSnapshot = { scan, competitors: competitorResult.data ?? [], observations: observationResult.data ?? [], tasks: taskResult.data ?? [] };
  const readError = scanReadError || competitorResult.error || observationResult.error || taskResult.error;
  const alert = errorMessage(query.error) || (readError ? "Some saved research could not be loaded. Your campaign is saved. Reload this page to try again." : "");

  return <BrandShell active="Competitors" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Campaign workspace · Research</p><h1 className={styles.appTitle}>Understand the competition</h1><p className={styles.appCopy}>Find relevant brands for {campaign.brand_name}, review their campaigns and audience evidence, then choose the competitors that will inform your brief.</p></header>
    {query.created === "1" ? <p className={styles.evidenceNote} role="status">Campaign saved. You can return to this draft from Home.</p> : null}
    <nav aria-label="Campaign steps" className={styles.steps}>
      <div className={styles.step}><span className={styles.stepIcon}>✓</span><strong>Brand & campaign</strong></div>
      <div className={styles.step} aria-current="step"><span className={styles.stepIcon}>2</span><strong>Competition & evidence</strong></div>
      <div className={styles.step}><span className={styles.stepIcon}>3</span><strong>Plan & creators</strong></div>
      <div className={styles.step}><span className={styles.stepIcon}>4</span><strong>Creative</strong></div>
    </nav>
    <SearchApiTestPanel />
    {alert ? <p className={styles.error} role="alert">{alert}</p> : null}
    {query.cached ? <p className={styles.evidenceNote} role="status">Using saved research from the last 24 hours. This action sent no new search request.</p> : null}
    {query.saved ? <p className={styles.evidenceNote} role="status">Shortlist updated.</p> : null}
    <ResearchPanel key={`${scan?.id ?? "new"}:${query.error ?? ""}`} campaign={campaign} initial={initial} readOnly={readOnly} activeScanId={activeScan?.id ?? null} />
    {(scans?.length ?? 0) > 1 ? <details style={{ marginTop: 20 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Research history</summary>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>{scans!.map((item) => <Link className={styles.textButton} key={item.id} href={`/brand/campaigns/${campaign.id}/competitors?scan=${item.id}`} aria-current={item.id === scan?.id ? "page" : undefined}>{when(item.created_at)} IST · {item.status === "succeeded" ? "Completed" : item.status === "failed" ? "Interrupted" : "In progress"}</Link>)}</div>
    </details> : null}
    <div className={styles.formActions}><Link className={styles.textButton} href="/brand/home">Save and exit</Link></div>
  </BrandShell>;
}
