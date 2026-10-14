"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Tables } from "@/types/database.types";
import brand from "../../../brand.module.css";
import styles from "./research.module.css";
import { recoverCompetitorResultsAction, runCompetitorScanAction, saveCompetitorSelectionAction } from "./actions";
import { ResearchButton } from "./submit-button";

export type ResearchScan = Tables<"brand_competitor_scans"> & { stage?: string; deadline_at?: string | null; requests_used?: number; cache_hits?: number };
export type ResearchCompetitor = Tables<"brand_competitors"> & { research_summary?: unknown; research_status?: string };
export type ResearchTask = { id: string; kind: string; status: string; error_code: string | null; next_attempt_at: string | null };
type Observation = Tables<"brand_competitor_observations">;
export type ResearchSnapshot = { scan: ResearchScan | null; competitors: ResearchCompetitor[]; observations: Observation[]; tasks: ResearchTask[] };
type Campaign = Pick<Tables<"brand_campaigns">, "id" | "title" | "brand_name" | "promoted_item" | "objective" | "deliverables">;
type Tab = "profile" | "ads" | "posts" | "comments";
const tabs: { id: Tab; label: string }[] = [{ id: "profile", label: "Full profile" }, { id: "ads", label: "Ads" }, { id: "posts", label: "Posts" }, { id: "comments", label: "Comments" }];
const stages = [
  { id: "discovery", title: "Find competitor candidates", kinds: ["discovery", "extract"] },
  { id: "verification", title: "Verify brands and websites", kinds: ["verify"] },
  { id: "evidence", title: "Collect campaign and audience evidence", kinds: ["meta_ads", "google_ads", "instagram_profile", "instagram_comments", "products", "fallback"] },
  { id: "report", title: "Prepare your competitor report", kinds: ["summarize"] },
];
const kinds: Record<string, string> = { meta_ad: "Meta ad", google_ad: "Google ad", social_post: "Social post", social_comment: "Public comment", product_price: "Product and price", web_fallback: "Web search evidence", discovery: "Discovery source", official_site: "Official website", reddit_excerpt: "Indexed Reddit excerpt", amazon_review: "Amazon review excerpt", amazon_product: "Product listing" };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "";
const when = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST" : "Unavailable";
const terminal = (status: string) => ["succeeded", "failed", "skipped", "uncertain"].includes(status);

/** Evidence links are public http(s) sources, never executable URLs or local hosts. */
function sourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(host) || /\.(?:local|internal|localhost)$/.test(host)) return;
    for (const key of [...url.searchParams.keys()]) if (/^(?:api_key|apikey|access_token|token|key)$/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return; }
}
function evidenceFor(competitor: ResearchCompetitor, observations: Observation[]) {
  const ids = new Set([...(competitor.evidence_ids ?? []), ...(Array.isArray(record(competitor.research_summary).evidence_ids) ? record(competitor.research_summary).evidence_ids as string[] : [])]);
  return observations.filter((item) => item.competitor_id === competitor.id || ids.has(item.id));
}
function inTab(item: Observation, tab: Tab) {
  if (tab === "ads") return ["meta_ad", "google_ad"].includes(item.evidence_kind);
  if (tab === "posts") return item.evidence_kind === "social_post";
  if (tab === "comments") return ["social_comment", "reddit_excerpt", "amazon_review"].includes(item.evidence_kind);
  return true;
}
function summaryRows(competitor: ResearchCompetitor) {
  const summary = record(competitor.research_summary);
  const sampleSize = typeof summary.sentiment_sample_size === "number" ? summary.sentiment_sample_size : null;
  return [
    ["Product / price", text(summary.product_price) || "Insufficient evidence"],
    ["Campaign evidence", text(summary.campaign) || "Insufficient evidence"],
    ["Social content", text(summary.social) || "Insufficient evidence"],
    ["Sampled sentiment", text(summary.sentiment) ? `${text(summary.sentiment)}${sampleSize !== null && sampleSize > 0 ? ` · ${sampleSize} comments` : ""}` : "Insufficient evidence"],
  ];
}
function stageState(stage: typeof stages[number], index: number, scan: ResearchScan | null, tasks: ResearchTask[]) {
  const related = tasks.filter((task) => stage.kinds.includes(task.kind));
  if (related.some((task) => task.status === "running")) return "In progress";
  if (related.length && related.every((task) => terminal(task.status))) return related.some((task) => ["failed", "uncertain", "skipped"].includes(task.status)) ? "Finished with gaps" : "Complete";
  const current = stages.findIndex((item) => item.id === scan?.stage);
  if (related.some((task) => task.status === "queued") && index <= current) return "Queued";
  if (scan?.stage === stage.id && scan.status === "running") return "In progress";
  if (current > index) return "Finished";
  return "Waiting";
}

export function ResearchPanel({ campaign, initial, readOnly, activeScanId }: { campaign: Campaign; initial: ResearchSnapshot; readOnly: boolean; activeScanId: string | null }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [pollError, setPollError] = useState("");
  const [selected, setSelected] = useState(() => new Set(initial.competitors.filter((item) => item.status === "confirmed").map((item) => item.id)));
  const [drawer, setDrawer] = useState<{ competitorId: string; tab: Tab } | null>(null);
  const [, startScan, starting] = useActionState(async (_: null, form: FormData) => { await runCompetitorScanAction(form); return null; }, null);
  const [, recover, recovering] = useActionState(async (_: null, form: FormData) => { await recoverCompetitorResultsAction(form); return null; }, null);
  const { scan, competitors, observations, tasks } = snapshot;
  const scanId = scan?.id;
  const running = !!scan && ["queued", "running"].includes(scan.status);
  const otherActive = activeScanId && activeScanId !== scan?.id;
  const available = competitors.filter((item) => item.status !== "rejected" && !!item.verified_at).slice(0, 5);
  const selectedCount = available.filter((item) => selected.has(item.id)).length;
  const selectedCompetitor = drawer ? competitors.find((item) => item.id === drawer.competitorId) : undefined;
  // Tasks update before the scan's stage checkpoint. Do not show "checking
  // identities" after all identity tasks have already finished.
  const verification = tasks.filter(task => task.kind === "verify");
  const evidenceTasks = tasks.filter(task => task.kind !== "fallback" && stages[2].kinds.includes(task.kind));
  const pendingFallback = tasks.some(task => task.kind === "fallback" && !terminal(task.status));
  const progressStage = tasks.some(task => task.kind === "summarize" && (task.status !== "queued" || evidenceTasks.every(task => terminal(task.status)))) ? "report"
    : evidenceTasks.length > 0 || verification.length > 0 && verification.every(task => terminal(task.status)) && !pendingFallback ? "evidence"
    : tasks.some(task => ["extract", "verify"].includes(task.kind)) ? "verification" : scan?.stage;
  const progressScan = scan ? { ...scan, stage: progressStage } : null;
  const partial = !!scan?.error_code || tasks.some((task) => ["failed", "uncertain"].includes(task.status));

  useEffect(() => {
    if (!running || !scanId) return;
    let stopped = false;
    let busy = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      let timedOut = false;
      const requestController = controller;
      const timeout = setTimeout(() => { timedOut = true; requestController.abort(); }, 15000);
      let delay = 3000;
      try {
        const response = await fetch(`/api/brand/campaigns/${campaign.id}/research?scan=${encodeURIComponent(scanId!)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          stopped = true;
          setPollError("Your session needs to be refreshed. Sign in again to see the saved research.");
          return;
        }
        if (!response.ok) throw new Error("research_status_unavailable");
        const result = await response.json() as ResearchSnapshot;
        if (!result.scan || result.scan.id !== scanId || !Array.isArray(result.competitors) || !Array.isArray(result.observations) || !Array.isArray(result.tasks)) throw new Error("research_status_unavailable");
        if (stopped) return;
        setSnapshot(result);
        setPollError("");
        if (!["queued", "running"].includes(result.scan.status)) stopped = true;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError" && !timedOut) return;
        if (!stopped) setPollError("We could not refresh progress. Your saved research is safe; we will reconnect automatically.");
        delay = 10000;
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!stopped && !document.hidden) timer = setTimeout(poll, delay);
      }
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void poll();
    }
    timer = setTimeout(poll, 3000);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [campaign.id, scanId, running]);

  function select(id: string, checked: boolean) {
    setSelected((previous) => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next; });
  }
  return <>
    <section className={brand.homeGrid}>
      <article className={brand.panel}><p className={brand.eyebrow}>{campaign.title}</p><h2 className={styles.campaignName}>{campaign.promoted_item}</h2><p className={brand.muted}>{campaign.objective.replaceAll("_", " ")} · {campaign.deliverables.map((item) => item.replaceAll("_", " ")).join(", ")}</p><p className={brand.muted}>India · Up to 5 verified brands · Reuse fresh research for 24 hours</p></article>
      <article className={brand.panel}><p className={brand.eyebrow}>Build your shortlist</p><p className={brand.muted}>Find competitors and collect public campaign, product and audience evidence. Three fresh scans per workspace per day.</p>
        <p className={brand.muted}>Fresh scan: maximum 32 SearchAPI requests, including retries. Saved searches are reused for 24 hours. Further paid research stops if fewer than 3 brands are verified. AI analysis is billed separately.</p>
        <form action={startScan}><input type="hidden" name="campaign_id" value={campaign.id} /><button className={`${brand.primaryButton} ${styles.scanButton}`} type="submit" disabled={starting || recovering || running || !!otherActive || readOnly} aria-busy={starting || running}>{starting ? "Queuing research…" : running || otherActive ? "Scan in progress…" : scan ? "Refresh competitor scan" : "Scan competition"}</button></form>
        {scan && !running && !readOnly ? <form action={recover}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="scan_id" value={scan.id} /><button className={brand.textButton} disabled={recovering || starting} type="submit">{recovering ? "Rechecking saved results…" : "Recheck saved results · No new searches"}</button></form> : null}
        {otherActive ? <Link className={styles.inlineLink} href={`/brand/campaigns/${campaign.id}/competitors?scan=${activeScanId}`}>View active research →</Link> : null}
      </article>
    </section>
    {readOnly ? <p className={brand.evidenceNote}>Campaign launched · Research history is read-only.</p> : null}
    <section className={styles.researchArea} aria-label="Competitor research">
      <div className={styles.researchContext}><strong>{campaign.brand_name} — {campaign.promoted_item}</strong><span>India · {campaign.objective.replaceAll("_", " ")}</span></div>
      {scan ? <p className={styles.coverage} aria-live="polite">SearchAPI requests attempted: {scan.requests_used ?? 0} / 32 · Saved responses reused: {scan.cache_hits ?? 0} · Sources saved: {observations.length}</p> : null}
      {scan?.error_code === "insufficient_verified_competitors" ? <p className={styles.notice} role="status">Paid research stopped because fewer than 3 competitors could be verified. Your saved evidence is available below. Check the brand and product details before starting fresh research.</p> : null}
      {starting || running ? <div className={styles.progress}>
        <div className={styles.sectionHeading}><div className={styles.progressHeading}><span className={styles.spinner} aria-hidden="true" /><div><h2>{starting ? "Queuing your research" : scan?.status === "queued" ? "Your scan is queued" : progressStage === "verification" ? "Checking competitor identities" : progressStage === "evidence" ? "Collecting competitor evidence" : progressStage === "report" ? "Preparing your report" : "Finding competitors"}</h2><p>{starting ? "Saving your request so progress can continue in the background." : scan?.status === "queued" ? "Your research will start when a research slot is available." : "Verified sources and findings are saved as research progresses."}</p></div></div><span className={styles.status} role="status">{starting || scan?.status === "queued" ? "Queued" : "In progress"}</span></div>
        <ol className={styles.progressSteps}>{stages.map((stage, index) => { const state = starting ? "Waiting" : stageState(stage, index, progressScan, tasks); return <li key={stage.id} data-state={state}><span className={styles.stepNumber} aria-hidden="true">{state === "Complete" ? "✓" : index + 1}</span><strong>{stage.title}</strong><span>{state}</span></li>; })}</ol>
        {pollError ? <p className={styles.notice} role="status">{pollError}</p> : null}
        <div className={styles.progressFooter}><p>{starting ? "Your scan will be saved before you leave this page." : "You can leave this page. Research will continue and results will be saved."}</p>{!starting ? <Link className={brand.secondaryButton} href="/brand/home">Back to workspace</Link> : null}</div>
      </div> : null}
      {!starting && scan?.status === "failed" ? <div className={styles.notice} role="status"><strong>Research was interrupted.</strong> Saved evidence is available below. You can revisit an earlier scan in Research history or start a new scan when available.</div> : null}
      {!starting && (available.length > 0 || scan?.status === "succeeded") ? <div className={styles.results}>
        <div className={styles.sectionHeading}><div><h2>Your competitor shortlist</h2><p>{available.length} verified {available.length === 1 ? "competitor" : "competitors"} {running ? "so far. Evidence is still being collected." : "found. Review the evidence and select the brands to include."}</p></div><span className={styles.status}>{running ? "Research in progress" : scan?.status === "failed" ? "Saved results" : partial ? "Completed · Some gaps" : "Research complete"}</span></div>
        {scan?.completed_at ? <p className={styles.dateLine}>Research completed {when(scan.completed_at)}</p> : null}
        {!available.length ? <p className={styles.empty}>Insufficient evidence to verify any competitors in this scan. We only show brands with supporting identity evidence.</p> : null}
        {!running && available.length > 0 && available.length < 5 ? <p className={styles.coverage}>Only {available.length} brands could be verified. The shortlist is not padded with unverified competitors.</p> : null}
        <form action={saveCompetitorSelectionAction}>
          <input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="scan_id" value={scan?.id ?? ""} />
          <div className={styles.cardGrid}>{available.map((competitor, index) => {
            const sources = evidenceFor(competitor, observations);
            return <article className={styles.competitorCard} data-selected={selected.has(competitor.id)} key={competitor.id}>
              <div className={styles.cardHeader}><span className={styles.rank} aria-hidden="true">{index + 1}</span><div><h3>{competitor.name}</h3><p>{competitor.official_domain}</p></div><label className={styles.checkbox}><input type="checkbox" name="competitor_ids" value={competitor.id} checked={selected.has(competitor.id)} onChange={(event) => select(competitor.id, event.target.checked)} disabled={readOnly || running || scan?.status !== "succeeded"} aria-label={`Select ${competitor.name} for campaign planning`} /></label></div>
              <dl className={styles.summary}>{summaryRows(competitor).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              <div className={styles.cardLinks}>{tabs.filter((tab) => tab.id !== "profile").map((tab) => <button type="button" key={tab.id} disabled={!sources.some((item) => inTab(item, tab.id))} onClick={() => setDrawer({ competitorId: competitor.id, tab: tab.id })} title={sources.some((item) => inTab(item, tab.id)) ? `View saved ${tab.label.toLowerCase()}` : `No ${tab.label.toLowerCase()} evidence saved`}>{tab.label}</button>)}<button type="button" className={styles.profileButton} onClick={() => setDrawer({ competitorId: competitor.id, tab: "profile" })}>View full profile →</button></div>
            </article>;
          })}</div>
          {available.length > 0 ? <><p className={styles.coverage}>Sentiment reflects retrieved comments, not the entire audience. Missing evidence does not mean a brand has no activity. Open a profile for sources and dates.</p><div className={styles.selectionFooter}><span aria-live="polite">{selectedCount} {selectedCount === 1 ? "competitor" : "competitors"} selected</span>{readOnly ? <Link className={brand.secondaryButton} href={`/brand/plan?campaign=${campaign.id}`}>View campaign brief →</Link> : <ResearchButton className={brand.primaryButton} pendingLabel="Saving selection…" disabled={!selectedCount || running || scan?.status !== "succeeded"}>Continue with selected →</ResearchButton>}</div></> : null}
        </form>
      </div> : null}
      {!starting && !scan ? <div className={styles.empty}><h2>Build your competitor shortlist</h2><p>Start a scan to find up to five relevant brands. Campaign evidence, products, social content and sampled sentiment will appear here.</p></div> : null}
    </section>
    {drawer && selectedCompetitor ? <EvidenceDrawer competitor={selectedCompetitor} observations={evidenceFor(selectedCompetitor, observations)} tab={drawer.tab} onTab={(tab) => setDrawer({ ...drawer, tab })} onClose={() => setDrawer(null)} /> : null}
  </>;
}

function EvidenceDrawer({ competitor, observations, tab, onTab, onClose }: { competitor: ResearchCompetitor; observations: Observation[]; tab: Tab; onTab: (tab: Tab) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const tabPrefix = useId();
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    if (node && !node.open) node.showModal();
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);
  function switchTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onTab(tabs[next].id);
    dialog.current?.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next].id}"]`)?.focus();
  }
  const visible = observations.filter((item) => inTab(item, tab));
  const website = sourceUrl(observations.find(item => item.evidence_kind === "official_site")?.source_url ?? `https://${competitor.official_domain}`);
  return <dialog className={styles.drawer} ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.drawerBody}>
      <header className={styles.drawerHeader}><div><p className={brand.eyebrow}>Saved competitor evidence</p><h2 id={titleId}>{competitor.name}</h2>{website ? <a href={website} target="_blank" rel="noopener noreferrer">{competitor.official_domain} ↗</a> : <span>{competitor.official_domain}</span>}</div><button className={styles.closeButton} type="button" autoFocus aria-label="Close competitor evidence" onClick={onClose}>×</button></header>
      <div className={styles.tabs} role="tablist" aria-label="Competitor evidence">{tabs.map((item, index) => <button type="button" key={item.id} role="tab" id={`${tabPrefix}-${item.id}`} data-tab={item.id} aria-controls={`${tabPrefix}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => switchTab(event, index)} onClick={() => onTab(item.id)}>{item.label}</button>)}</div>
      <div className={styles.drawerContent} role="tabpanel" id={`${tabPrefix}-panel`} aria-labelledby={`${tabPrefix}-${tab}`} tabIndex={0}>
        <p className={styles.coverage}>These are saved results. Opening evidence does not start another scan.</p>
        {tab === "profile" ? <><h3>Why this competitor</h3><p className={styles.rationale}>{competitor.rationale}</p><p className={styles.dateLine}>Identity evidence checked {when(competitor.verified_at)}</p><dl className={styles.profileSummary}>{summaryRows(competitor).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.coverage}>Prices are observations for particular listings and dates. Advertising spend and full campaign performance are unavailable from these sources.</p><h3>Sources and observations</h3></> : null}
        {tab === "comments" ? <p className={styles.notice}>This is a limited public-comment sample. Sentiment describes the retrieved comments and should not be treated as a measure of the whole audience.</p> : null}
        {tab === "ads" ? <p className={styles.coverage}>Public advertising evidence may not include every campaign. Dates and platforms are shown only when returned by the source.</p> : null}
        {!visible.length ? <div className={styles.empty}><h3>Insufficient evidence</h3><p>No {tab === "profile" ? "source" : tab} evidence was saved for this competitor in this scan.</p></div> : <div className={styles.sourceList}>{visible.map((item) => <EvidenceItem key={item.id} observation={item} />)}</div>}
      </div>
    </div>
  </dialog>;
}

function EvidenceItem({ observation: item }: { observation: Observation }) {
  const url = sourceUrl(item.source_url);
  const isAd = ["meta_ad", "google_ad"].includes(item.evidence_kind);
  const attributes = record(item.attributes);
  const platforms = Array.isArray(attributes.platforms) ? attributes.platforms.map(text).filter(Boolean).join(", ") : "";
  const platform = platforms || text(attributes.platform) || (item.evidence_kind === "meta_ad" ? "Meta" : item.evidence_kind === "google_ad" ? "Google" : item.evidence_kind.startsWith("social_") ? "Instagram" : "");
  const details: [string, string][] = [
    ["Format", text(attributes.format)], ["Call to action", text(attributes.callToAction)],
    ["Last shown", text(attributes.lastShownDate)], ["End date", text(attributes.endDate)],
  ];
  if (typeof attributes.active === "boolean") details.push(["Ad status at retrieval", attributes.active ? "Active" : "Inactive"]);
  for (const [key, label] of [["likes", "Likes"], ["comments", "Comments"], ["totalDaysShown", "Days shown"]]) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) details.push([label, value.toLocaleString("en-IN")]);
  }
  return <article className={styles.sourceCard}>
    <div className={styles.sourceMeta}><span>{kinds[item.evidence_kind] ?? "Saved source"}</span>{platform ? <span>{platform}</span> : null}</div>
    <h4>{item.source_title || "Source observation"}</h4>
    {item.evidence_kind === "web_fallback" ? <p className={styles.coverage}>Web-search-assisted summary. Check the linked source for the original wording.</p> : null}
    <p>{item.source_snippet || (isAd ? "Creative available at source. Open the original ad to view it." : "No text excerpt was returned. Open the original source for context.")}</p>
    {details.some(([, value]) => value) ? <dl className={styles.sourceDates}>{details.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
    <dl className={styles.sourceDates}><div><dt>Source</dt><dd>{item.source_domain}</dd></div><div><dt>Source date</dt><dd>{item.source_date_text || (item.published_at ? when(item.published_at) : "Unavailable")}</dd></div><div><dt>Retrieved</dt><dd>{when(item.observed_at)}</dd></div></dl>
    {url ? <a className={styles.inlineLink} href={url} target="_blank" rel="noopener noreferrer">{isAd ? "Open original ad ↗" : "Open original source ↗"}</a> : <span className={styles.coverage}>Original source link unavailable.</span>}
  </article>;
}
