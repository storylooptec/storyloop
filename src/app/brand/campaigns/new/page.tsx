import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { CampaignDraftForm } from "@/components/brand/campaign-draft-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../../brand.module.css";

export default async function NewBrandCampaignPage() {
  const context = await requireBrandContext();
  const db = await createServerSupabaseClient();
  const { data: lastCampaign } = await db.from("brand_campaigns")
    .select("brand_name,website_url").eq("company_id", context.companyId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <BrandShell active="Plan" companyName={context.companyName} email={context.email}>
      <div className={styles.campaignSetup}>
        <header>
          <p className={styles.eyebrow}>New campaign · Step 1 of 4</p>
          <h1 className={styles.appTitle}>Start with your brand</h1>
          <p className={styles.appCopy}>Tell us what you’re promoting. You can add the finer details later.</p>
        </header>
        <ol aria-label="Campaign steps" className={styles.setupSteps}>
          {["Brand & campaign", "Competitors", "Plan & creators", "Creative"].map((step, index) => (
            <li key={step} aria-current={index === 0 ? "step" : undefined}>
              <span aria-hidden="true">{index + 1}</span>{step}
            </li>
          ))}
        </ol>
        <CampaignDraftForm previousBrand={lastCampaign ?? undefined} />
      </div>
    </BrandShell>
  );
}
