import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import styles from "../../brand.module.css";

import { createCampaignDraftAction } from "./actions";

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

      <form action={createCampaignDraftAction} className={styles.formWrap} encType="multipart/form-data">
        <section className={styles.panel}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Brand name <span aria-hidden="true">*</span>
              <input name="brand_name" placeholder="e.g. Aurelia Skincare" maxLength={120} required />
            </label>
            <label className={styles.field}>
              Website <span className={styles.muted}>(optional)</span>
              <input name="website_url" type="text" inputMode="url" placeholder="yourbrand.com" />
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              Brand logo <span className={styles.muted}>(optional)</span>
              <span className={styles.uploadBox}>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
                <span className={styles.muted}>PNG, JPG or WebP · maximum 5 MB · stored securely in Storyloop’s R2 asset path</span>
              </span>
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              What are you promoting? <span aria-hidden="true">*</span>
              <input name="promoted_item" placeholder="Product, service, or launch" maxLength={240} required />
            </label>

            <label className={styles.field + " " + styles.spanAll}>
              Campaign name <span className={styles.muted}>(optional)</span>
              <input name="title" placeholder="e.g. Summer launch" maxLength={120} />
            </label>

            <label className={styles.field}>
              Planned campaign budget <span className={styles.muted}>(optional, INR)</span>
              <input name="budget_inr" type="number" min="0" max="1000000000" step="1000" placeholder="e.g. 250000" />
              <span className={styles.muted}>Used for the budget check after creator rates and Storyloop history are available.</span>
            </label>

            <label className={styles.field}>
              Campaign objective <span aria-hidden="true">*</span>
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
            <Link href="/brand/home" className={styles.textButton}>Save and leave</Link>
            <button type="submit" className={styles.primaryButton}>Save draft and scan competitors <span aria-hidden="true">→</span></button>
          </div>
        </section>
      </form>
    </BrandShell>
  );
}
