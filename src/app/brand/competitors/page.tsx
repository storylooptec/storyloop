import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

export default async function BrandCompetitorsPage() {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,brand_name,status,updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  return (
    <BrandShell active="Competitors" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Evidence workspace</p>
        <h1 className={styles.appTitle}>Competitor observations</h1>
        <p className={styles.appCopy}>Each scan stores dated source observations. Search candidates remain unconfirmed until your team reviews them.</p>
      </header>
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div className={styles.campaignList}>
          {campaigns?.length ? campaigns.map((campaign) => (
            <article className={styles.campaignRow} key={campaign.id}>
              <div><strong>{campaign.title}</strong><div className={styles.muted}>{campaign.brand_name} · updated {new Date(campaign.updated_at).toLocaleDateString("en-IN")}</div></div>
              <Link className={styles.secondaryButton} href={"/brand/campaigns/" + campaign.id + "/competitors"}>Open scan →</Link>
            </article>
          )) : (
            <div className={styles.emptyState}>No campaign scans yet. Add a brand, optional website and promoted item to start the first scan.</div>
          )}
        </div>
        <Link href="/brand/campaigns/new" className={styles.primaryButton} style={{ marginTop: 18 }}>Create campaign</Link>
      </section>
    </BrandShell>
  );
}
