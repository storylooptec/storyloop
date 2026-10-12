import Link from "next/link";
import { notFound } from "next/navigation";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

type Props = { searchParams: Promise<{ campaign?: string }> };

export default async function BrandPlanPage({ searchParams }: Props) {
  const [{ campaign: campaignId }, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,brand_name,promoted_item,objective,deliverables,status")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  const campaign = campaignId ? campaigns?.find((item) => item.id === campaignId) : campaigns?.[0];
  if (campaignId && !campaign) notFound();

  const { data: observations } = campaign
    ? await supabase.from("brand_competitor_observations")
        .select("id,competitor_name,source_title,source_url,source_snippet,observed_at")
        .eq("company_id", context.companyId)
        .order("observed_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return (
    <BrandShell active="Plan" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign workspace · Step 3</p>
        <h1 className={styles.appTitle}>Turn evidence into an approved brief</h1>
        <p className={styles.appCopy}>The plan will connect the campaign objective, dated competitor evidence, creator mix, Storyloop rates and an internal benchmark based on Storyloop campaign history.</p>
      </header>
      {campaign ? (
        <section className={styles.homeGrid}>
          <article className={styles.panel}>
            <p className={styles.eyebrow}>Campaign brief inputs</p>
            <h2 style={{ margin: 0, fontSize: 19 }}>{campaign.title}</h2>
            <p className={styles.muted}>{campaign.brand_name} · {campaign.promoted_item}</p>
            <div className={styles.campaignList}>
              <div className={styles.campaignRow}><span>Objective</span><strong>{campaign.objective}</strong></div>
              <div className={styles.campaignRow}><span>Requested content</span><strong>{campaign.deliverables.join(", ") || "Not set"}</strong></div>
              <div className={styles.campaignRow}><span>Creator and rate benchmark</span><span className={styles.statusPill}>Awaiting eligible catalog</span></div>
              <div className={styles.campaignRow}><span>Campaign-history benchmark</span><span className={styles.statusPill}>Uses Storyloop history only</span></div>
            </div>
            <p className={styles.evidenceNote}>The structured brief editor and budget calculation are the next planning slice; no unsupported benchmark values are shown.</p>
            <Link href={"/brand/campaigns/" + campaign.id + "/competitors"} className={styles.secondaryButton}>Review evidence</Link>
          </article>
          <article className={styles.panel}>
            <p className={styles.eyebrow}>Evidence available</p>
            {observations?.length ? (
              <div className={styles.campaignList}>
                {observations.map((item) => (
                  <div className={styles.campaignRow} key={item.id}>
                    <div><strong>{item.competitor_name}</strong><div className={styles.muted}>{item.source_snippet || item.source_title}</div><small className={styles.muted}>Observed {new Date(item.observed_at).toLocaleDateString("en-IN")}</small></div>
                    <a className={styles.textButton} href={item.source_url} target="_blank" rel="noreferrer">Source ↗</a>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Run a competitor scan first. Recommendations will reference saved observations and source links.</div>
            )}
          </article>
        </section>
      ) : (
        <section className={styles.panel}><div className={styles.emptyState}>Create a campaign to start planning.</div><Link href="/brand/campaigns/new" className={styles.primaryButton}>Create campaign</Link></section>
      )}
    </BrandShell>
  );
}
