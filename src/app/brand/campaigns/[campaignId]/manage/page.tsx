import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { isUuid } from "@/brand/reporting";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transitionCampaignAction } from "./actions";
import styles from "../../../brand.module.css";

type Props = { params: Promise<{ campaignId: string }>; searchParams: Promise<{ error?: string; saved?: string }> };
export default async function CampaignManagePage({ params, searchParams }: Props) {
  const [{ campaignId }, query, context] = await Promise.all([params, searchParams, requireBrandContext()]);
  if (!isUuid(campaignId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: campaign, error } = await supabase.from("brand_campaigns").select("id,title,status,actual_live_at,completed_at")
    .eq("id", campaignId).eq("company_id", context.companyId).maybeSingle();
  if (error) throw new Error("Unable to load campaign status.");
  if (!campaign) notFound();
  const [{ data: plan, error: planError }, { data: creatives, error: creativeError }] = await Promise.all([
    supabase.from("brand_campaign_plans").select("approval_state,revision").eq("campaign_id", campaignId).eq("company_id", context.companyId).maybeSingle(),
    supabase.from("brand_campaign_creatives").select("id,approval_state,plan_revision").eq("campaign_id", campaignId).eq("company_id", context.companyId).eq("approval_state", "approved"),
  ]);
  if (planError || creativeError) throw new Error("Unable to check campaign approvals.");
  const briefReady = plan?.approval_state === "approved";
  const creativeReady = briefReady && creatives?.some((creative) => creative.plan_revision === plan?.revision);
  const ready = briefReady && creativeReady && !["active", "completed", "archived"].includes(campaign.status);
  const today = new Date().toISOString().slice(0, 10);
  return <BrandShell active="Create" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Campaign workspace</p><h1 className={styles.appTitle}>{campaign.title}</h1><p className={styles.appCopy}>Review readiness and record when the campaign actually goes live. This updates Storyloop tracking; publishing and booking are handled separately.</p></header>
    {query.error ? <p className={styles.error} role="alert">{query.error === "validation" ? "Choose a valid date no later than today and confirm the campaign event." : "The status could not be changed. Check the current brief and creative approvals, current status and event date."}</p> : null}
    {query.saved ? <p className={styles.evidenceNote} role="status">Campaign status updated.</p> : null}
    <section className={styles.panel} style={{ marginTop: 24 }}><span className={styles.statusPill}>{campaign.status.replaceAll("_", " ")}</span><h2>Readiness</h2>
      <div className={styles.campaignRow}><div><strong>Campaign brief</strong><p className={styles.muted}>{briefReady ? "Current brief approved" : "Approval required"}</p></div><Link href={`/brand/plan?campaign=${campaign.id}`} className={styles.secondaryButton}>Review brief</Link></div>
      <div className={styles.campaignRow}><div><strong>Campaign creative</strong><p className={styles.muted}>{creativeReady ? "Creative approved for the current brief" : "Approve creative based on the current approved brief"}</p></div><Link href={`/brand/create?campaign=${campaign.id}`} className={styles.secondaryButton}>Review creative</Link></div>
      <div className={styles.campaignRow}><div><strong>Creator selection</strong><p className={styles.muted}>Optional while Storyloop builds the creator directory. A campaign can be tracked without a creator booking.</p></div><Link href={`/brand/discover?campaign=${campaign.id}`} className={styles.secondaryButton}>Discover</Link></div>
    </section>
    {ready ? <section className={styles.panel} style={{ marginTop: 18 }}><h2>Record actual launch</h2><p className={styles.appCopy}>Use this after campaign content or paid distribution is live.</p><form action={transitionCampaignAction} className={styles.formWrap}>
      <input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="status" value="active" />
      <label className={styles.field}>Actual launch date (UTC)<input type="date" name="event_date" max={today} required /></label>
      <label className={styles.checkboxChip} style={{ margin: "16px 0" }}><input type="checkbox" name="confirmed" required />I confirm this campaign is live on the selected date.</label><div><button className={styles.primaryButton}>Mark campaign live</button></div>
    </form></section> : null}
    {campaign.status === "active" ? <section className={styles.panel} style={{ marginTop: 18 }}><h2>Campaign is live</h2><p className={styles.appCopy}>Launched {campaign.actual_live_at?.slice(0, 10)} UTC. Reports update when measurements are recorded.</p><Link href={`/brand/reports?campaign=${campaign.id}`} className={styles.secondaryButton}>View reports</Link><form action={transitionCampaignAction} className={styles.formWrap}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="status" value="completed" /><label className={styles.field}>Actual completion date (UTC)<input type="date" name="event_date" min={campaign.actual_live_at?.slice(0, 10)} max={today} required /></label><label className={styles.checkboxChip} style={{ margin: "16px 0" }}><input type="checkbox" name="confirmed" required />I confirm the campaign has finished.</label><div><button className={styles.secondaryButton}>Mark completed</button></div></form></section> : null}
    {campaign.status === "completed" ? <section className={styles.panel} style={{ marginTop: 18 }}><h2>Campaign completed</h2><p className={styles.appCopy}>{campaign.actual_live_at?.slice(0, 10)} to {campaign.completed_at?.slice(0, 10)} UTC. Late measurements and corrections can still update your report.</p><Link href={`/brand/reports?campaign=${campaign.id}`} className={styles.primaryButton}>View results</Link></section> : null}
  </BrandShell>;
}
