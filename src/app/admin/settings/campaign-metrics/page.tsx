import Link from "next/link";
import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { metricKeys, metricPlatforms } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveCampaignMetricsAction } from "./actions";

type Props = { searchParams: Promise<{ campaign?: string; edit?: string; saved?: string; error?: string }> };
const labels = { views: "Views", impressions: "Impressions", engagements: "Engagements", clicks: "Clicks", conversions: "Conversions", spend_cents: "Actual spend (INR)", revenue_cents: "Attributed revenue (INR)" };
export default async function CampaignMetricsPage({ searchParams }: Props) {
  await requirePermission(permissions.operationsWork);
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: campaigns, error } = await supabase.from("brand_campaigns").select("id,title,company_id,actual_live_at").in("status", ["active", "completed"]).order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error("Unable to load campaign measurements.");
  const campaign = campaigns?.find((item) => item.id === params.campaign);
  const { data: rows, error: metricsError } = campaign ? await supabase.from("brand_campaign_metrics").select("*").eq("campaign_id", campaign.id).eq("company_id", campaign.company_id).order("metric_date", { ascending: false }).limit(100) : { data: [], error: null };
  if (metricsError) throw new Error("Unable to load measurements.");
  const editing = rows?.find((row) => row.id === params.edit);
  return <>
    <p className="sl-system-label page-eyebrow">Platform / Campaign measurements</p><h1 className="page-title">Campaign metrics</h1><p className="page-copy">Record daily values from a platform export or approved measurement source. Brand Reports reads these records. All dates use UTC and amounts use INR.</p>
    {params.saved ? <p className="settings-notice" role="status">Measurement saved. Any existing record for the same campaign, platform, post and day was replaced.</p> : null}
    {params.error ? <p className="settings-notice" role="alert">{params.error === "date" ? "Measurement date must be on or after the recorded campaign launch date." : params.error === "save" ? "Could not save the measurement. Check your operator permission and the campaign state." : "Check the source, post ID, date and nonnegative values. At least one measurement and daily-value confirmation are required."}</p> : null}
    <section className="settings-section"><form className="settings-form"><div className="settings-grid"><label>Launched campaign<select name="campaign" defaultValue={campaign?.id ?? ""}><option value="">Select campaign</option>{campaigns?.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.company_id}</option>)}</select></label></div><button className="secondary-button">Open campaign</button></form>{!campaigns?.length ? <p className="settings-notice">No launched campaigns. A brand must record its actual launch before measurements can be entered.</p> : null}</section>
    {campaign ? <>
      <section className="settings-section"><h2>{editing ? "Correct measurement" : "Record measurement"} · {campaign.title}</h2><p className="page-copy">Enter additions during one UTC day, never a lifetime snapshot. Use the same external post ID every time. Leave unmeasured fields blank; enter 0 only for measured zero. Spend must use a consistent scope across rows; do not repeat whole-campaign spend on every post.</p>
        <form action={saveCampaignMetricsAction} className="settings-form" key={editing?.id ?? "new"}><input type="hidden" name="campaign_id" value={campaign.id} /><div className="settings-grid">
          <label>UTC day<input type="date" name="metric_date" defaultValue={editing?.metric_date} min={campaign.actual_live_at?.slice(0, 10)} max={new Date().toISOString().slice(0, 10)} required /></label>
          <label>Platform<select name="platform" defaultValue={editing?.platform ?? "instagram"}>{metricPlatforms.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Stable external post or ad ID<input name="external_post_id" defaultValue={editing?.external_post_id} minLength={1} maxLength={240} required /></label>
          <label>Source export / report reference<input name="source_reference" defaultValue={editing?.source_reference} minLength={3} maxLength={1000} placeholder="Export file / report URL and attribution window" required /></label>
          {metricKeys.map((key) => <label key={key}>{labels[key]}<input name={key} type="number" min="0" step={key.endsWith("cents") ? "0.01" : "1"} defaultValue={editing?.[key] === null || editing?.[key] === undefined ? "" : key.endsWith("cents") ? editing[key]! / 100 : editing[key]!} /></label>)}
        </div><label><input type="checkbox" name="daily_confirmed" required /> I checked that these are daily additions from the stated source, with no duplicated post or campaign spend.</label><button className="primary-button">Save daily measurement</button>{editing ? <Link className="secondary-button" href={`/admin/settings/campaign-metrics?campaign=${campaign.id}`}>Cancel correction</Link> : null}</form>
      </section>
      <section className="settings-section"><h2>Latest 100 source records</h2><div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Date</th><th>Platform / post</th><th>Source</th><th>Updated</th><th>Action</th></tr></thead><tbody>{rows?.map((row) => <tr key={row.id}><td>{row.metric_date}</td><td>{row.platform}<small>{row.external_post_id}</small></td><td>{row.source_reference}</td><td>{new Date(row.updated_at).toLocaleString("en-IN", { timeZone: "UTC" })} UTC</td><td><Link href={`/admin/settings/campaign-metrics?campaign=${campaign.id}&edit=${row.id}`}>Correct values</Link></td></tr>)}</tbody></table></div>{!rows?.length ? <p className="settings-notice">No source measurements recorded yet.</p> : null}</section>
    </> : null}
  </>;
}
