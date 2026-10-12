import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { compareObservations, objectValue } from "@/brand/competition";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../../../brand.module.css";
import { addManualCompetitorAction, enrichCompetitorAction, reviewCompetitorAction, runCompetitorScanAction, selectCompetitorProductAction } from "./actions";

import { ResearchButton } from "./submit-button";

export const maxDuration = 180;
type Props = { params: Promise<{ campaignId: string }>; searchParams: Promise<{ cached?: string; error?: string; scanned?: string; saved?: string; created?: string; enriched?: string; reviews?: string; scan?: string }> };
const when = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
function errorMessage(code?: string) {
  if (!code) return "";
  if (/limit|quota|budget/.test(code)) return "This workspace's request or spending limit has been reached. Your saved evidence is still available. Admin can check the usage window.";
  if (/configured|disabled|auth_failed/.test(code)) return "Research is not available in this environment yet. Your campaign is saved; Admin can check the provider connection.";
  if (code === "scan_running") return "Research is already running. Refresh this page shortly to see the result.";
  if (code === "official_site_unverified") return "We could not verify this brand name on the supplied official domain. Check the spelling or use its main website.";
  if (code === "invalid_competitor") return "Enter another competing brand and its official website. A publisher, marketplace or your own brand cannot be added here.";
  if (code === "five_competitors") return "You already have five competitors in this scan. Reject one before adding a replacement.";
  if (code === "scan_required") return "Run the first scan before adding a competitor manually.";
  if (code === "confirm_required") return "Confirm this competitor's relevance before collecting customer evidence.";
  if (code === "product_unverified") return "The returned product page did not match the selected competitor. No reviews were added. Choose another product.";
  if (code === "campaign_read_only") return "Research is read-only after launch. Your approved evidence history remains available.";
  if (code === "provider_circuit_open") return "The research provider is temporarily unavailable. Your previous observations are preserved.";
  return "This research step could not finish. Your saved evidence is preserved. Try again later; request details are available in Admin API Health.";
}
const kindLabels: Record<string, string> = { discovery: "Discovery source", official_site: "Official-site search excerpt", reddit_excerpt: "Indexed Reddit excerpt", amazon_product: "Selected Amazon product", amazon_review: "Amazon review excerpt" };

export default async function CompetitorScanPage({ params, searchParams }: Props) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const context = await requireBrandContext();
  // Server component: capture request time once to expose recovery for expired research locks.
  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now();
  const db = await createServerSupabaseClient();
  const { data: campaign } = await db.from("brand_campaigns").select("id,title,brand_name,promoted_item,objective,deliverables,status")
    .eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (!campaign) notFound();
  const readOnly = ["active", "completed", "archived"].includes(campaign.status);
  const { data: scans } = await db.from("brand_competitor_scans").select("id,status,result_count,error_code,created_at,completed_at,started_at")
    .eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(20);
  const successful = (scans ?? []).filter((item) => item.status === "succeeded");
  const scan = successful.find((item) => item.id === query.scan) ?? successful[0] ?? null;
  const previous = scan ? successful[successful.findIndex((item) => item.id === scan.id) + 1] : null;
  const running = (scans ?? []).some((item) => ["queued", "running"].includes(item.status) && item.started_at && Date.parse(item.started_at) > requestTime - 15 * 60 * 1000);
  const [{ data: competitors }, { data: observations }, { data: products }, { data: previousObservations }] = scan ? await Promise.all([
    db.from("brand_competitors").select("*").eq("scan_id", scan.id).eq("company_id", context.companyId).order("created_at"),
    db.from("brand_competitor_observations").select("*").eq("scan_id", scan.id).eq("company_id", context.companyId).order("observed_at", { ascending: false }),
    db.from("brand_competitor_products").select("*").eq("scan_id", scan.id).eq("company_id", context.companyId).order("title"),
    previous ? db.from("brand_competitor_observations").select("source_record_key,content_hash,evidence_kind").eq("scan_id", previous.id).eq("company_id", context.companyId) : Promise.resolve({ data: [] }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const activeCompetitors = (competitors ?? []).filter((item) => item.status !== "rejected");
  const confirmed = activeCompetitors.filter((item) => item.status === "confirmed");
  const evidenceById = new Map((observations ?? []).map((item) => [item.id, item]));
  const baselineKinds = ["discovery", "official_site"];
  const comparison = compareObservations((observations ?? []).filter((item) => baselineKinds.includes(item.evidence_kind)), (previousObservations ?? []).filter((item) => baselineKinds.includes(item.evidence_kind)));
  const alert = errorMessage(query.error);
  const confirmedIds = new Set(confirmed.map((item) => item.id));
  const customerEvidence = (observations ?? []).filter((item) => item.competitor_id && confirmedIds.has(item.competitor_id) && ["reddit_excerpt", "amazon_review"].includes(item.evidence_kind));
  const selectedProducts = (products ?? []).filter((item) => item.status === "selected" && confirmedIds.has(item.competitor_id));
  return (
    <BrandShell active="Competitors" companyName={context.companyName} email={context.email}>
      <header><p className={styles.eyebrow}>Campaign workspace · Research</p><h1 className={styles.appTitle}>Understand the competition</h1><p className={styles.appCopy}>Find relevant brands for {campaign.brand_name}, confirm the shortlist, then collect customer observations to shape your campaign.</p></header>
      {query.created === "1" ? <p className={styles.evidenceNote} role="status">Campaign saved. You can return to this draft from Home.</p> : null}
      <nav aria-label="Campaign steps" className={styles.steps}>
        <div className={styles.step}><span className={styles.stepIcon}>✓</span><strong>Brand & campaign</strong></div><div className={styles.step}><span className={styles.stepIcon}>2</span><strong>Competition & evidence</strong></div><div className={styles.step}><span className={styles.stepIcon}>3</span><strong>Plan & creators</strong></div><div className={styles.step}><span className={styles.stepIcon}>4</span><strong>Creative</strong></div>
      </nav>
      <section className={styles.homeGrid}>
        <article className={styles.panel}><p className={styles.eyebrow}>{campaign.title}</p><h2 style={{ fontSize: 18, margin: 0 }}>{campaign.promoted_item}</h2><p className={styles.muted}>{campaign.objective} · {campaign.deliverables.join(", ")}</p><p className={styles.muted}>India · Up to 5 relevant brands · Sources saved for 24 hours</p></article>
        <article className={styles.panel}><p className={styles.eyebrow}>Build your shortlist</p><p className={styles.muted}>A scan finds business names and checks their official domains. Review relevance before confirming. Three new scans per company per day.</p><form action={runCompetitorScanAction}><input type="hidden" name="campaign_id" value={campaign.id} /><ResearchButton className={styles.primaryButton} disabled={running || readOnly} pendingLabel="Finding and checking competitors…">{running ? "Scan in progress…" : scan ? "Refresh competitor scan" : "Scan competition"}</ResearchButton></form></article>
      </section>
      {readOnly ? <p className={styles.evidenceNote}>Campaign launched · Research history is read-only.</p> : null}
      {alert ? <p className={styles.error} role="alert">{alert}</p> : null}
      {query.cached ? <p className={styles.evidenceNote} role="status">Using saved research from the last 24 hours. This action sent no new search request.</p> : null}
      {query.scanned ? <p className={styles.evidenceNote} role="status">Scan finished. Confirm the brands that compete with your product; fewer than five are shown when the evidence is insufficient.</p> : null}
      {query.saved ? <p className={styles.evidenceNote} role="status">Shortlist updated.</p> : null}
      {query.enriched ? <p className={styles.evidenceNote} role="status">Customer-source search finished. Select a matching Amazon product below to collect its available review excerpts.</p> : null}
      {query.reviews ? <p className={styles.evidenceNote} role="status">Product checked. Available on-page review excerpts have been saved; some product pages return no reviews.</p> : null}
      {scans?.[0]?.status === "failed" ? <p className={styles.error}>The most recent scan did not complete. {scan ? "Your last successful scan remains available below." : "Retry when the provider is available."}</p> : null}
      {scan?.error_code === "partial_verification" ? <p className={styles.evidenceNote}>Some domain checks could not finish. Only candidates with retrieved official-site evidence appear below.</p> : null}
      {scan ? <section className={styles.panel} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}><div><p className={styles.eyebrow}>Your competitor shortlist</p><h2 style={{ fontSize: 20, margin: 0 }}>{confirmed.length} confirmed · {activeCompetitors.length - confirmed.length} to review</h2><p className={styles.muted}>Domain evidence checked · Relevance selected by your team · Spend unavailable</p></div><span className={styles.statusPill}>{when(scan.completed_at ?? scan.created_at)} IST</span></div>
        {!competitors?.length ? <p className={styles.emptyState}>The search did not provide enough evidence to verify competitor identities. Add a known competitor below; we will check its official domain before it joins the shortlist.</p> : null}
        <div className={styles.campaignList}>{(competitors ?? []).map((competitor) => {
          const relatedEvidence = (observations ?? []).filter((item) => item.competitor_id === competitor.id && ["reddit_excerpt", "amazon_review"].includes(item.evidence_kind));
          const matches = (products ?? []).filter((item) => item.competitor_id === competitor.id);
          return <article className={styles.campaignRow} key={competitor.id} style={{ display: "block", opacity: competitor.status === "rejected" ? .65 : 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 14 }}><div><span className={styles.statusPill}>{competitor.status === "candidate" ? "Review relevance" : competitor.status}</span><h3 style={{ margin: "9px 0 5px" }}>{competitor.name}</h3><a href={`https://${competitor.official_domain}`} target="_blank" rel="noreferrer" className={styles.textButton}>{competitor.official_domain} ↗</a></div><div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
              {competitor.status !== "confirmed" ? <form action={reviewCompetitorAction}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="competitor_id" value={competitor.id} /><input type="hidden" name="status" value="confirmed" /><button className={styles.primaryButton} disabled={readOnly}>Confirm competitor</button></form> : null}
              {competitor.status !== "rejected" ? <form action={reviewCompetitorAction}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="competitor_id" value={competitor.id} /><input type="hidden" name="status" value="rejected" /><button className={styles.secondaryButton} disabled={readOnly}>Reject</button></form> : null}
            </div></div>
            <p className={styles.muted}>{competitor.rationale}</p><p className={styles.muted}>Official-domain match observed {when(competitor.verified_at)} IST. Search relevance does not measure market share.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>{competitor.evidence_ids.map((id) => { const item = evidenceById.get(id); return item ? <a key={id} className={styles.textButton} href={`#evidence-${id}`}>{item.evidence_kind === "official_site" ? "Official-site evidence" : "Discovery evidence"}</a> : null; })}</div>
            {competitor.status === "confirmed" ? <div style={{ marginTop: 14 }}><form action={enrichCompetitorAction} className={styles.loginForm}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="competitor_id" value={competitor.id} /><label className={styles.rememberRow}><input type="checkbox" name="amazon" defaultChecked />Also find matching products on Amazon.in</label><div><ResearchButton pendingLabel="Collecting customer sources…" className={styles.secondaryButton} disabled={readOnly || competitor.enrichment_status === "running" && !!competitor.enrichment_started_at && Date.parse(competitor.enrichment_started_at) > requestTime - 15 * 60 * 1000}>{competitor.enrichment_status === "running" ? "Collecting customer sources…" : "Collect customer evidence"}</ResearchButton></div></form><p className={styles.muted}>{relatedEvidence.length} saved customer-source excerpts. Reddit results cover indexed snippets; Amazon reviews cover a partial product-page sample.</p>
              {competitor.enrichment_status === "failed" ? <p className={styles.error}>Customer-source search was interrupted. Saved excerpts remain available; retry to finish.</p> : null}
              {competitor.enrichment_status === "succeeded" && !matches.length ? <p className={styles.muted}>No matching Amazon products were saved in this search.</p> : null}
              {matches.length ? <details open><summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Check the matching product before collecting reviews ({matches.length})</summary><div className={styles.campaignList}>{matches.map((product) => <div className={styles.campaignRow} key={product.id} style={{ flexWrap: "wrap" }}><div style={{ flex: "1 1 230px" }}><strong style={{ fontSize: 13 }}>{product.title}</strong><p className={styles.muted}>ASIN {product.asin} · {product.price_text ?? "Price not returned"} · {product.rating === null ? "Rating not returned" : `${product.rating}/5`} · {product.review_count === null ? "Review count not returned" : `${product.review_count.toLocaleString("en-IN")} reviews`}</p><p className={styles.muted}>Observed {when(product.observed_at)} IST · <a href={product.source_url} target="_blank" rel="noreferrer" className={styles.textButton}>Open product ↗</a></p></div><form action={selectCompetitorProductAction}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="competitor_id" value={competitor.id} /><input type="hidden" name="product_id" value={product.id} /><ResearchButton className={styles.secondaryButton} disabled={readOnly} pendingLabel="Checking product and reviews…">{product.status === "selected" ? "Product selected · Recheck" : "Use this product & get reviews"}</ResearchButton></form></div>)}</div></details> : null}
            </div> : null}
          </article>;
        })}</div>
        <details style={{ marginTop: 18 }}><summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Add or correct a competitor</summary><p className={styles.muted}>Enter the brand and its main website. To replace a competitor with another domain, reject the old entry first. An existing domain can be corrected here and will need confirmation again.</p><form action={addManualCompetitorAction} className={styles.formGrid}><input type="hidden" name="campaign_id" value={campaign.id} /><label className={styles.field}>Competitor name<input name="name" required minLength={2} maxLength={100} placeholder="Brand name" /></label><label className={styles.field}>Official website<input name="official_domain" required maxLength={253} placeholder="brand.com" inputMode="url" /></label><div className={styles.spanAll}><ResearchButton className={styles.secondaryButton} disabled={readOnly} pendingLabel="Checking official website…">Verify and add</ResearchButton></div></form></details>
      </section> : <section className={styles.panel} style={{ marginTop: 18 }}><p className={styles.emptyState}>Start a scan to create your first evidence baseline. The shortlist will contain business names with source links and official-domain matches.</p></section>}
      {scan ? <section className={styles.homeGrid}>
        <article className={styles.panel}><p className={styles.eyebrow}>Observed changes</p>{previous ? <><h2 style={{ fontSize: 20 }}>{comparison.added} new · {comparison.changed} changed</h2><p className={styles.muted}>{comparison.unchanged} seen again · {comparison.absent} absent from this scan. Compared with {when(previous.completed_at ?? previous.created_at)} IST.</p><p className={styles.muted}>Calculated from discovery and official-site result snapshots. Search ranking, excerpts and coverage can change independently of a business.</p></> : <p className={styles.muted}>First successful baseline. A later scan will compare the same source URLs and excerpt hashes.</p>}</article>
        <article className={styles.panel}><p className={styles.eyebrow}>Ready to inform your brief</p><h2 style={{ fontSize: 20 }}>{customerEvidence.length} customer-source excerpts</h2><p className={styles.muted}>Use dated observations to propose pain points and USP hypotheses. Each claim needs evidence and your approval.</p><p className={styles.muted}><strong>Competitor advertising spend:</strong> unavailable from these sources.</p></article>
      </section> : null}
      {selectedProducts.length ? <section className={styles.panel} style={{ marginTop: 18 }}><p className={styles.eyebrow}>Selected product observations</p><p className={styles.muted}>Prices, ratings and counts are the values returned for each listing at the time shown. Different sizes, variants and offers are not normalized.</p><div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12, textAlign: "left", borderCollapse: "collapse" }}><thead><tr>{["Product", "Listed price", "Rating", "Review count", "Observed"].map((label) => <th key={label} style={{ padding: 10 }}>{label}</th>)}</tr></thead><tbody>{selectedProducts.map((product) => <tr key={product.id}><td style={{ padding: 10 }}>{product.title}</td><td style={{ padding: 10 }}>{product.price_text ?? "Unavailable"}</td><td style={{ padding: 10 }}>{product.rating === null ? "Unavailable" : `${product.rating}/5`}</td><td style={{ padding: 10 }}>{product.review_count ?? "Unavailable"}</td><td style={{ padding: 10 }}>{when(product.observed_at)} IST</td></tr>)}</tbody></table></div></section> : null}
      {(observations ?? []).length ? <section className={styles.panel} style={{ marginTop: 18 }}><p className={styles.eyebrow}>Evidence notebook</p><h2 style={{ fontSize: 20, margin: 0 }}>{observations!.length} dated source observations</h2><p className={styles.muted}>Source dates are displayed only when returned. Retrieval time is not publication time. Review links may open the product page where the excerpt was observed.</p><div className={styles.campaignList}>{observations!.map((item) => { const details = objectValue(item.attributes); return <details key={item.id} id={`evidence-${item.id}`} className={styles.campaignRow} style={{ display: "block", scrollMarginTop: 24 }}><summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>{kindLabels[item.evidence_kind] ?? "Source"} · {item.source_title}</summary><p className={styles.muted}>{item.source_snippet || "No text excerpt was returned. Open the source for context."}</p><p className={styles.muted}>{item.competitor_id ? item.competitor_name + " · " : ""}{item.source_domain} · Observed {when(item.observed_at)} IST{item.source_date_text ? ` · Source date: ${item.source_date_text}` : " · Source date unavailable"}</p>{item.evidence_kind === "amazon_review" ? <p className={styles.muted}>Partial review sample · {typeof details.rating === "number" ? `${details.rating}/5 · ` : ""}{details.verified_purchase === true ? "Purchase marked verified by Amazon" : "Purchase verification not confirmed"}</p> : null}<a className={styles.textButton} href={item.source_url} target="_blank" rel="noreferrer">View source ↗</a></details>; })}</div></section> : null}
      {successful.length > 1 ? <details style={{ marginTop: 18 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>Previous successful scans</summary><div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>{successful.map((item) => <Link className={styles.textButton} key={item.id} href={`/brand/campaigns/${campaign.id}/competitors?scan=${item.id}`}>{when(item.created_at)} IST</Link>)}</div></details> : null}
      <div className={styles.formActions}><Link className={styles.textButton} href="/brand/home">Save and exit</Link>{confirmed.length ? <Link className={styles.primaryButton} href={`/brand/plan?campaign=${campaign.id}`}>Continue to your brief →</Link> : <span className={styles.muted}>Confirm a competitor to continue to your brief.</span>}</div>
    </BrandShell>
  );
}
