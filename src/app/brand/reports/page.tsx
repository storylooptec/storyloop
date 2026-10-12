import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";

export default async function BrandReportsPage() {
  const context = await requireBrandContext();
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("brand_campaigns")
    .select("id,title,status,updated_at")
    .eq("company_id", context.companyId)
    .in("status", ["active", "completed"])
    .order("updated_at", { ascending: false });

  return (
    <BrandShell active="Reports" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign reporting</p>
        <h1 className={styles.appTitle}>Performance grounded in campaign data</h1>
        <p className={styles.appCopy}>Reports will show platform and conversion metrics received for launched campaigns. Storyloop will label tracked values and will not present modeled ROAS as actual revenue.</p>
      </header>
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div className={styles.campaignList}>
          {campaigns?.length ? campaigns.map((campaign) => (
            <article key={campaign.id} className={styles.campaignRow}>
              <div><strong>{campaign.title}</strong><div className={styles.muted}>{campaign.status.replaceAll("_", " ")} · updated {new Date(campaign.updated_at).toLocaleDateString("en-IN")}</div></div>
              <span className={styles.statusPill}>Awaiting metric source</span>
            </article>
          )) : (
            <div className={styles.emptyState}>No launched campaigns or performance data yet. Reports become available after launch and a metric source is connected.</div>
          )}
        </div>
        <Link href="/brand/home" className={styles.secondaryButton}>Back to campaign room</Link>
      </section>
    </BrandShell>
  );
}
