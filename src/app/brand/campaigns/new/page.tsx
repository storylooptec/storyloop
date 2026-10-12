import Link from "next/link";
import { SubmitButton } from "@/components/brand/submit-button";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import styles from "../../brand.module.css";

import { CampaignDraftForm } from "@/components/brand/campaign-draft-form";

export default async function NewBrandCampaignPage() {
  const context = await requireBrandContext();

  return (
    <BrandShell active="Plan" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign setup · Step 1 of 4</p>
        <h1 className={styles.appTitle}>Start with your brand</h1>
        <p className={styles.appCopy}>Add the essentials. Storyloop will use these details to find relevant competitors and shape an evidence-backed campaign brief.</p>
      </header>

      <nav aria-label="Campaign steps" className={styles.steps}>
        <div className={styles.step}><span className={styles.stepIcon}>1</span><strong>Brand & campaign</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>2</span><strong>Competitor scan</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>3</span><strong>Plan & creators</strong></div>
        <div className={styles.step}><span className={styles.stepIcon}>4</span><strong>Creative</strong></div>
      </nav>

      <CampaignDraftForm>
        <section className={styles.panel}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Brand name <span aria-hidden="true">*</span></span>
              <input name="brand_name" placeholder="e.g. Aurelia Skincare" maxLength={120} required />
            </label>
            <label className={styles.field}>
              <span>Website <span className={styles.muted}>(optional)</span></span>
              <input name="website_url" type="text" inputMode="url" placeholder="yourbrand.com" />
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              <span>Brand logo <span className={styles.muted}>(optional)</span></span>
              <span className={styles.uploadBox}>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
                <span className={styles.muted}>PNG, JPG or WebP · maximum 5 MB · stored securely</span>
              </span>
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              <span>What are you promoting? <span aria-hidden="true">*</span></span>
              <input name="promoted_item" placeholder="Product, service, or launch" maxLength={240} required />
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              <span>Campaign name <span className={styles.muted}>(optional)</span></span>
              <input name="title" placeholder="e.g. Summer launch" maxLength={120} />
            </label>

            <label className={styles.field}>
              <span>Planned campaign budget <span className={styles.muted}>(optional, INR)</span></span>
              <input name="budget_inr" type="number" min="0" max="1000000000" step="0.01" placeholder="e.g. 250000" />
              <span className={styles.muted}>Used for the budget check after creator rates and Storyloop history are available.</span>
            </label>

            <label className={styles.field}>
              <span>Campaign objective <span aria-hidden="true">*</span></span>
              <select name="objective" defaultValue="awareness" required>
                <option value="awareness">Awareness</option>
                <option value="consideration">Consideration</option>
                <option value="sales">Sales</option>
              </select>
            </label>

            <fieldset className={styles.field + " " + styles.spanAll} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ padding: 0, marginBottom: 9 }}>Requested deliverables <span aria-hidden="true">*</span></legend>
              <div className={styles.deliverables}>
                <label className={styles.checkboxChip}><input type="checkbox" name="deliverable" value="instagram_reel" /> Instagram Reel</label>
                <label className={styles.checkboxChip}><input type="checkbox" name="deliverable" value="youtube_short" /> YouTube Short</label>
                <label className={styles.checkboxChip}><input type="checkbox" name="deliverable" value="instagram_story" /> Instagram Story</label>
                <label className={styles.checkboxChip}><input type="checkbox" name="deliverable" value="static_post" /> Static post</label>
              </div>
              <span className={styles.muted}>Choose the formats you want Storyloop to plan for.</span>
            </fieldset>
          </div>
          <div className={styles.formActions}>
            <Link href="/brand/home" className={styles.textButton}>Cancel</Link>
            <SubmitButton className={styles.primaryButton}>Save and continue to competitors <span aria-hidden="true">→</span></SubmitButton>
          </div>
        </section>
      </CampaignDraftForm>
    </BrandShell>
  );
}
