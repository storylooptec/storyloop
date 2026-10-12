import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

export default async function BrandCreatePage() {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,status,objective,deliverables")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <BrandShell active="Create" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign workspace · Step 4</p>
        <h1 className={styles.appTitle}>Create campaign content</h1>
        <p className={styles.appCopy}>Develop creator-ready angles, hooks and scripts from the approved brief. AI previews require explicit creator approval before using a creator’s likeness.</p>
      </header>
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div className={styles.campaignList}>
          {campaigns?.length ? campaigns.map((campaign) => (
            <article className={styles.campaignRow} key={campaign.id}>
              <div><strong>{campaign.title}</strong><div className={styles.muted}>{campaign.objective} · {campaign.deliverables.join(", ")}</div></div>
              <span className={styles.statusPill}>{campaign.status.replaceAll("_", " ")}</span>
            </article>
          )) : <div className={styles.emptyState}>Create a campaign and approve its plan before generating campaign creative.</div>}
        </div>
        <div className={styles.evidenceNote}>Preview generation is an explicit action and will use the configured Higgsfield API only after the creator’s consent scope allows brand requests.</div>
        <Link href="/brand/plan" className={styles.secondaryButton}>Go to campaign plan →</Link>
      </section>
    </BrandShell>
  );
}
