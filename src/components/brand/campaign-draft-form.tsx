"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createCampaignDraftAction } from "@/app/brand/campaigns/new/actions";
import styles from "@/app/brand/brand.module.css";

const formats = [
  ["instagram_reel", "Instagram Reel"], ["youtube_short", "YouTube Short"],
  ["instagram_story", "Instagram Story"], ["static_post", "Static post"],
];

type Props = { previousBrand?: { brand_name: string; website_url: string | null } };

export function CampaignDraftForm({ previousBrand }: Props) {
  const [state, action, pending] = useActionState(createCampaignDraftAction, null);
  const [brandName, setBrandName] = useState(previousBrand?.brand_name ?? "");
  const [website, setWebsite] = useState(previousBrand?.website_url ?? "");
  const [promotedItem, setPromotedItem] = useState("");
  const [objective, setObjective] = useState("awareness");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const error = clientError ?? state?.error;
  const suggestedTitle = brandName.trim() && promotedItem.trim()
    ? `${brandName.trim()} — ${promotedItem.trim()}`.slice(0, 120) : "Generated from your brand and product";

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error, state]);

  return (
    <form action={(data) => {
      // React resets file inputs after an action. Retain the selected file for a failed-save retry.
      if (logo) data.set("logo", logo);
      action(data);
    }} onReset={event => event.preventDefault()} onSubmit={(event) => {
      let message: string | null = null;
      if (!deliverables.length) message = "Select at least one deliverable.";
      else if (logo && !["image/png", "image/jpeg", "image/webp"].includes(logo.type)) message = "Use a PNG, JPG or WebP logo.";
      else if (logo && logo.size > 5 * 1024 * 1024) message = "Choose a logo smaller than 5 MB, or remove it to continue.";
      setClientError(message);
      if (message || pending) event.preventDefault();
    }} className={styles.setupForm} aria-busy={pending}>
      <section className={styles.panel} aria-label="Campaign details">
        {previousBrand ? <p className={styles.reusedBrand}>Brand details filled from your last campaign. You can change them.</p> : null}
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Brand name <span aria-hidden="true">*</span></span>
            <input name="brand_name" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Aurelia Skincare" maxLength={120} autoComplete="organization" required />
          </label>
          <label className={styles.field}>
            <span>Website <span className={styles.muted}>(optional)</span></span>
            <input name="website_url" value={website} onChange={e => setWebsite(e.target.value)} inputMode="url" autoComplete="url" placeholder="yourbrand.com" maxLength={2048} />
          </label>
          <label className={styles.field}>
            <span>What are you promoting? <span aria-hidden="true">*</span></span>
            <input name="promoted_item" value={promotedItem} onChange={e => setPromotedItem(e.target.value)} placeholder="e.g. Our new daily sunscreen" maxLength={240} required />
          </label>
          <label className={styles.field}>
            <span>Campaign objective <span aria-hidden="true">*</span></span>
            <select name="objective" value={objective} onChange={e => setObjective(e.target.value)} required>
              <option value="awareness">Build awareness</option>
              <option value="consideration">Drive consideration</option>
              <option value="sales">Grow sales</option>
            </select>
          </label>
          <fieldset className={styles.formatFieldset}>
            <legend>Content formats <span aria-hidden="true">*</span></legend>
            <div className={styles.deliverables}>
              {formats.map(([value, label]) => <label key={value} className={styles.checkboxChip}>
                <input type="checkbox" name="deliverable" value={value} checked={deliverables.includes(value)} onChange={e => {
                  setDeliverables(current => e.target.checked ? [...current, value] : current.filter(item => item !== value));
                  setClientError(null);
                }} />{label}
              </label>)}
            </div>
            <p className={styles.fieldHint}>Choose one or more. You can refine quantities in your brief.</p>
          </fieldset>
        </div>

        <details className={styles.optionalDetails}>
          <summary>Campaign name, budget & logo <span>Optional</span></summary>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Campaign name</span>
              <input name="title" value={title} onChange={e => setTitle(e.target.value)} placeholder={suggestedTitle} maxLength={120} />
              <span className={styles.fieldHint}>Leave blank to use the suggested name.</span>
            </label>
            <label className={styles.field}>
              <span>Planned budget (₹)</span>
              <input name="budget_inr" value={budget} onChange={e => setBudget(e.target.value)} type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" placeholder="e.g. 250000" />
              <span className={styles.fieldHint}>Leave blank if you haven’t decided.</span>
            </label>
            <div className={styles.compactUpload}>
              <label className={styles.field} htmlFor="campaign-logo">Brand logo</label>
              <input ref={fileRef} id="campaign-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { setLogo(e.target.files?.[0] ?? null); setClientError(null); }} aria-describedby="logo-hint" />
              <span id="logo-hint" className={styles.fieldHint}>PNG, JPG or WebP · up to 5 MB</span>
              {logo ? <div className={styles.selectedLogo}><span>Selected: {logo.name}</span><button type="button" className={styles.textButton} onClick={() => { setLogo(null); setClientError(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove logo</button></div> : null}
            </div>
          </div>
        </details>
      </section>
      <div className={styles.setupSaveBar}>
        {error ? <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p> : null}
        <div className={styles.setupSaveRow}>
          <Link href="/brand/home" className={styles.textButton}>Cancel</Link>
          <div className={styles.saveSummary}><span>Campaign name</span><strong>{title.trim() || suggestedTitle}</strong></div>
          <button type="submit" className={styles.primaryButton} disabled={pending}>{pending ? "Saving campaign…" : "Save & continue"}<span aria-hidden="true"> →</span></button>
        </div>
        <p className={styles.saveHint}>Saves a draft. Competitor research starts only when you request it.</p>
      </div>
    </form>
  );
}
