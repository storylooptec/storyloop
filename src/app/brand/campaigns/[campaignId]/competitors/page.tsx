import Link from "next/link";
import { notFound } from "next/navigation";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../../../brand.module.css";

import { runCompetitorScanAction } from "./actions";

type Props = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ cached?: string; error?: string; scanned?: string }>;
};

function messageFor(error?: string) {
  switch (error) {
    case "limit": return "The workspace scan limit has been reached. Try again after the daily window resets.";
    case "provider": return "Search is not enabled in this environment. No external request was made.";
    case "running": return "A competitor scan is already running for this campaign.";
    case "campaign": return "This campaign could not be opened.";
    case "scan": return "The scan failed. Try again later; provider details stay in the admin health log.";
    default: return "";
  }
}

export default async function CompetitorScanPage({ params, searchParams }: Props) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();

  const { data: campaign } = await supabase
    .from("brand_campaigns")
    .select("id,title,brand_name,website_url,promoted_item,objective,deliverables,status")
    .eq("id", campaignId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: latestScan } = await supabase
    .from("brand_competitor_scans")
    .select("id,status,result_count,created_at,completed_at")
    .eq("campaign_id", campaign.id)
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: observations } = latestScan
    ? await supabase
        .from("brand_competitor_observations")
        .select("id,competitor_name,competitor_domain,source_url,source_domain,source_title,source_snippet,published_at,observed_at")
        .eq("scan_id", latestScan.id)
        .eq("company_id", context.companyId)
        .order("observed_at", { ascending: false })
    : { data: [] };

  const alert = messageFor(query.error);
  const scanCompleted = latestScan?.status === "succeeded";

  return (
    <BrandShell active="Competitors" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign workspace · Step 2 of 4</p>
        <h1 className={styles.appTitle}>Competitor scan</h1>
        <p className={styles.appCopy}>Review public search observations related to <strong>{campaign.brand_name}</strong>. Review each result and its source before treating it as a competitor.</p>
      </header>

      <nav aria-label="Campaign steps" className={styles.steps}>
        <div className={styles.step}><span className={styles.stepIcon}>✓</span><strong>Brand & campaign</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>2</span><strong>Competitor scan</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>3</span><strong>Plan & creators</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>4</span><strong>Creative</strong></div>
      </nav>

      <section className={styles.homeGrid}>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Campaign input</p>
          <h2 style={{ margin: 0, fontSize: 18 }}>{campaign.title}</h2>
          <p className={styles.muted}>{campaign.promoted_item} · {campaign.objective} · {campaign.deliverables.join(", ")}</p>
          <p className={styles.muted}>Search market: India · Search candidates: up to 5 · Refresh cache: 24 hours</p>
        </article>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Evidence rules</p>
          <p className={styles.muted}>Search results are evidence sources, not verified competitor brands or facts. Each item shows its source and the date Storyloop observed it. No competitor spend is presented as fact.</p>
          <form action={runCompetitorScanAction}>
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <button type="submit" className={styles.primaryButton}>
              {scanCompleted ? "Refresh competitor scan" : "Scan competition"}
            </button>
          </form>
        </article>
      </section>

      {query.cached ? <p className={styles.evidenceNote} role="status">Showing the saved scan from the last 24 hours; no new SerpApi request was sent.</p> : null}
      {query.scanned ? <p className={styles.evidenceNote} role="status">Scan complete. These search results are ready for review.</p> : null}
      {alert ? <p className={styles.error} role="alert">{alert}</p> : null}

      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <p className={styles.eyebrow}>Search result observations</p>
            <h2 style={{ margin: 0, fontSize: 19 }}>{scanCompleted ? (observations?.length ?? 0) + " source results to review" : "No scan run yet"}</h2>
          </div>
          {latestScan ? <span className={styles.statusPill}>{latestScan.status}</span> : null}
        </div>

        {scanCompleted && observations?.length ? (
          <div className={styles.campaignList}>
            {observations.map((item, index) => (
              <article key={item.id} className={styles.campaignRow} style={{ alignItems: "start" }}>
                <div style={{ minWidth: 0 }}>
                  <span className={styles.statusPill}>Search result {index + 1}</span>
                  <h3 style={{ margin: "10px 0 4px", fontSize: 16 }}>{item.source_title}</h3>
                  <p className={styles.muted}>Source domain: {item.source_domain}</p>
                  <p className={styles.muted}>{item.source_snippet || "Open the source to review the result."}</p>
                  <small className={styles.muted}>Observed {new Date(item.observed_at).toLocaleString("en-IN")}{item.published_at ? " · Source date " + new Date(item.published_at).toLocaleDateString("en-IN") : ""}</small>
                </div>
                <a className={styles.secondaryButton} href={item.source_url} target="_blank" rel="noreferrer">View source ↗</a>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {scanCompleted
              ? "The search did not return reviewable source results. Adjust the brand or product details and scan again."
              : "Run a scan to collect the first dated baseline. After a later scan, Storyloop can compare new observations with this baseline."}
          </div>
        )}
      </section>

      <div className={styles.formActions}>
        <Link href="/brand/home" className={styles.textButton}>Save and exit</Link>
        {scanCompleted ? (
          <Link href={"/brand/plan?campaign=" + campaign.id} className={styles.primaryButton}>
            Continue to brief and creator planning →
          </Link>
        ) : (
          <button type="button" className={styles.secondaryButton} disabled>
            Continue after scan
          </button>
        )}
      </div>
    </BrandShell>
  );
}
