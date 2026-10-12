import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

export default async function BrandDiscoverPage() {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,status,objective,deliverables")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <BrandShell active="Discover" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Creator discovery</p>
        <h1 className={styles.appTitle}>Find the right creators</h1>
        <p className={styles.appCopy}>Storyloop will match creators to the approved brief, deliverable mix and budget, using creator-provided rates and campaign history.</p>
      </header>

      <section className={styles.homeGrid}>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Creator directory</p>
          <h2 style={{ margin: 0, fontSize: 19 }}>No verified creator profiles to show yet</h2>
          <p className={styles.muted}>Profiles and rates will appear here after the directory consent and access rules are enabled. Storyloop will only show active, eligible creator profiles.</p>
          <div className={styles.emptyState}>No demo profiles are mixed into live creator matching.</div>
        </article>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>Campaign matching</p>
          {campaigns?.length ? (
            <div className={styles.campaignList}>
              {campaigns.map((campaign) => (
                <div key={campaign.id} className={styles.campaignRow}>
                  <div><strong>{campaign.title}</strong><div className={styles.muted}>{campaign.objective} · {campaign.deliverables.join(", ") || "No deliverables set"}</div></div>
                  <span className={styles.statusPill}>{campaign.status.replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>Create a campaign and approve its brief to start matching.</p>
          )}
          <Link href="/brand/campaigns/new" className={styles.secondaryButton}>Start a campaign</Link>
        </article>
      </section>
    </BrandShell>
  );
}
