import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

export default async function BrandHomePage() {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,status,updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <BrandShell active="Home" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Brand workspace</p>
        <h1 className={styles.appTitle}>Your campaign room</h1>
        <p className={styles.appCopy}>Build a campaign from market evidence, then carry the approved plan through creator selection, creative and reporting.</p>
      </header>

      <section className={styles.homeGrid}>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Storyloop recommendation</p>
          <h2 style={{ margin: 0, fontSize: 19 }}>Your market brief will appear here</h2>
          <p className={styles.muted}>After a competitor scan, Storyloop will show the evidence, key pain areas and campaign opportunities behind each recommendation.</p>
          <Link href="/brand/campaigns/new" className={styles.primaryButton} style={{ marginTop: 16 }}>Start a campaign</Link>
        </article>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Market this week</p>
          <p className={styles.muted}>No scan has been run for this workspace yet. Every observation will include a date and source.</p>
          <Link href="/brand/campaigns/new" className={styles.secondaryButton} style={{ marginTop: 14 }}>Begin with brand details</Link>
        </article>
      </section>

      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className={styles.eyebrow}>Campaigns</p>
            <h2 style={{ margin: 0, fontSize: 19 }}>Your work in progress</h2>
          </div>
          <Link href="/brand/campaigns/new" className={styles.secondaryButton}>New campaign</Link>
        </div>
        {campaigns?.length ? (
          <div className={styles.campaignList}>
            {campaigns.map((campaign) => (
              <div className={styles.campaignRow} key={campaign.id}>
                <div><strong>{campaign.title}</strong><div className={styles.muted}>Updated {new Date(campaign.updated_at).toLocaleDateString("en-IN")}</div></div>
                <span className={styles.statusPill}>{campaign.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No campaigns yet. Start with the brand name, website, logo, objective and requested deliverables.</div>
        )}
      </section>
    </BrandShell>
  );
}
