import Link from "next/link";
import { requireBrandContext } from "@/brand/context";
import { dateRange, metricPlatforms, summarizeMetrics, type MetricValues } from "@/brand/reporting";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

type Props = { searchParams: Promise<{ campaign?: string; from?: string; to?: string; platform?: string }> };
type ReportRow = MetricValues & { id: string; metric_date: string; platform: string; external_post_id: string; source_reference: string; source_type: string; updated_at: string };
const count = (value: number | null) => value === null ? "Awaiting data" : new Intl.NumberFormat("en-IN").format(value);
const money = (value: number | null) => value === null ? "Awaiting data" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default async function BrandReportsPage({ searchParams }: Props) {
  const [params, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const range = dateRange(params.from, params.to);
  const platform = metricPlatforms.find((item) => item === params.platform);
  const { data: campaigns, error: campaignError } = await supabase.from("brand_campaigns").select("id,title,status,actual_live_at,completed_at")
    .eq("company_id", context.companyId).in("status", ["active", "completed"]).order("updated_at", { ascending: false });
  if (campaignError) throw new Error("Unable to load campaigns for reporting.");
  const campaign = params.campaign ? campaigns?.find((item) => item.id === params.campaign) : campaigns?.[0];
  const rows: ReportRow[] = [];
  let tooMany = false;
  if (campaign) {
    // Page explicitly: Supabase response row limits must not silently truncate totals.
    for (let offset = 0; offset < 10_000; offset += 500) {
      let query = supabase.from("brand_campaign_metrics").select("id,metric_date,platform,external_post_id,source_type,source_reference,views,impressions,engagements,clicks,conversions,spend_cents,revenue_cents,updated_at", { count: "exact" })
        .eq("campaign_id", campaign.id).eq("company_id", context.companyId).gte("metric_date", range.from).lte("metric_date", range.to)
        .order("metric_date", { ascending: false }).order("id").range(offset, offset + 499);
      if (platform) query = query.eq("platform", platform);
      const { data, count: rowCount, error } = await query;
      if (error) throw new Error("Unable to load campaign measurements.");
      if ((rowCount ?? 0) > 10_000) { tooMany = true; break; }
      rows.push(...(data ?? []) as ReportRow[]);
      if ((data?.length ?? 0) < 500) break;
    }
  }
  const report = summarizeMetrics(rows);
  const cards = [
    { label: "Views", key: "views" as const }, { label: "Impressions", key: "impressions" as const },
    { label: "Engagements", key: "engagements" as const }, { label: "Clicks", key: "clicks" as const },
    { label: "Conversions", key: "conversions" as const }, { label: "Recorded spend", key: "spend_cents" as const },
    { label: "Attributed revenue", key: "revenue_cents" as const },
  ];
  return <BrandShell active="Reports" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Measured campaign performance</p><h1 className={styles.appTitle}>Reports</h1>
      <p className={styles.appCopy}>Track campaign results recorded from platform exports and conversion sources. All dates use UTC; money is in INR.</p></header>
    <section className={styles.panel} style={{ marginTop: 24 }}>
      <form className={styles.formGrid}>
        <label className={styles.field}>Campaign<select name="campaign" defaultValue={campaign?.id ?? ""}><option value="">Choose a launched campaign</option>{campaigns?.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.status}</option>)}</select></label>
        <label className={styles.field}>Platform<select name="platform" defaultValue={platform ?? ""}><option value="">All platforms</option>{metricPlatforms.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={styles.field}>From<input type="date" name="from" defaultValue={range.from} /></label><label className={styles.field}>Through<input type="date" name="to" defaultValue={range.to} /></label>
        <button className={styles.secondaryButton}>Apply filters</button>
      </form>
    </section>
    {!campaign ? <section className={styles.panel} style={{ marginTop: 18 }}><h2>No launched campaign selected</h2><p className={styles.appCopy}>Approve your campaign brief and creative, then record the actual launch date in the campaign workspace. Results appear when Storyloop records campaign measurements.</p><Link className={styles.secondaryButton} href="/brand/home">Open campaign workspace</Link></section>
      : tooMany ? <p className={styles.error}>This filter includes more than 10,000 measurements. Narrow the dates or platform to see complete totals.</p>
      : <>
        <div className={styles.formActions}><div><strong>{campaign.title}</strong><p className={styles.muted}>Launched {campaign.actual_live_at ? new Date(campaign.actual_live_at).toLocaleDateString("en-IN", { timeZone: "UTC" }) : "date unavailable"} · {rows.length} daily measurements</p></div><Link className={styles.secondaryButton} href={`/brand/campaigns/${campaign.id}/manage`}>Campaign status</Link></div>
        {rows.length === 0 ? <section className={styles.panel}><h2>No measurements for these filters</h2><p className={styles.appCopy}>Storyloop has not recorded results for this campaign, date range and platform yet. We will show measured values when a source is added.</p></section> : <>
          <section className={styles.formGrid} style={{ marginTop: 18 }} aria-label="Campaign totals">{cards.map(({ label, key }) => {
            const metric = report.totals[key];
            return <article className={styles.panel} key={key}><p className={styles.eyebrow}>{label}</p><strong style={{ fontSize: 26 }}>{key.endsWith("cents") ? money(metric.value === null ? null : metric.value / 100) : count(metric.value)}</strong><p className={styles.muted}>{metric.reported} of {metric.total} measurements reported{metric.reported < metric.total ? " · partial total" : ""}</p></article>;
          })}</section>
          <section className={styles.panel} style={{ marginTop: 18 }}><h2>Efficiency</h2><div className={styles.formGrid}>
            <div><strong>CTR · {report.ctr === null ? "Unavailable" : report.ctr.toFixed(2) + "%"}</strong><p className={styles.muted}>Clicks ÷ impressions</p></div>
            <div><strong>CPC · {report.cpc === null ? "Unavailable" : money(report.cpc)}</strong><p className={styles.muted}>Recorded spend ÷ clicks</p></div>
            <div><strong>CPM · {report.cpm === null ? "Unavailable" : money(report.cpm)}</strong><p className={styles.muted}>Recorded spend ÷ impressions × 1,000</p></div>
            <div><strong>ROAS · {report.roas === null ? "Unavailable" : report.roas.toFixed(2) + "×"}</strong><p className={styles.muted}>Attributed revenue ÷ recorded spend</p></div>
          </div><p className={styles.muted}>Ratios require both inputs on every measurement and a nonzero denominator. Revenue attribution and spend scope come from the recorded source; these totals are not an incremental-lift estimate.</p></section>
          <section className={styles.panel} style={{ marginTop: 18 }}><h2>Source measurements</h2><p className={styles.muted}>Daily additions for each post and UTC date. Corrections replace the same post/day record, so repeat imports do not add duplicate totals. Showing the latest {Math.min(rows.length, 100)} of {rows.length} measurements.</p><div style={{ overflowX: "auto" }}><table className="audit-table"><thead><tr><th>Date / platform</th><th>Post / source</th><th>Views</th><th>Impressions</th><th>Engagements</th><th>Clicks</th><th>Conversions</th><th>Spend</th><th>Revenue</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.id}><td>{row.metric_date}<small>{row.platform}</small></td><td>{row.external_post_id}<small>{row.source_reference}</small><small>Updated {new Date(row.updated_at).toLocaleString("en-IN", { timeZone: "UTC" })} UTC</small></td><td>{count(row.views)}</td><td>{count(row.impressions)}</td><td>{count(row.engagements)}</td><td>{count(row.clicks)}</td><td>{count(row.conversions)}</td><td>{money(row.spend_cents === null ? null : row.spend_cents / 100)}</td><td>{money(row.revenue_cents === null ? null : row.revenue_cents / 100)}</td></tr>)}</tbody></table></div></section>
        </>}
      </>}
  </BrandShell>;
}
