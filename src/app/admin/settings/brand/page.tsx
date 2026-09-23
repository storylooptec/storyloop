import { requireAdminContext } from "@/auth/admin-context";
import { BrandColorControl } from "@/components/admin/brand-color-control";
import { BrandLivePreview } from "@/components/admin/brand-live-preview";
import { ContextHelp } from "@/components/admin/context-help";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { adminHelp } from "@/help/admin-help";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveBrandSettings } from "./actions";
import { removeBrandAssetAction, uploadBrandAssetAction } from "./upload-actions";

type Props = {
  searchParams: Promise<{ saved?: string; uploaded?: string; removed?: string }>;
};

function objectValue(
  value: unknown,
  key: string,
  fallback: string | number | null,
) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const result = (value as Record<string, unknown>)[key];
    if (typeof result === "string" || typeof result === "number") return result;
    if (result === null) return null;
  }
  return fallback;
}

function assetMeta(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { filename: "No file uploaded", publicUrl: null as string | null };
  }
  const record = value as Record<string, unknown>;
  return {
    filename: typeof record.originalFilename === "string" ? record.originalFilename : "Uploaded",
    publicUrl: typeof record.publicUrl === "string" ? record.publicUrl : null,
  };
}

function UploadControl({
  title,
  slot,
  metadata,
  editable,
  accept,
  guidance,
}: {
  title: string;
  slot: string;
  metadata: unknown;
  editable: boolean;
  accept: string;
  guidance: string;
}) {
  const asset = assetMeta(metadata);
  const hasAsset = asset.filename !== "No file uploaded";

  return (
    <article className="brand-upload-card">
      <div className="brand-asset-preview">
        {asset.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.publicUrl} alt={`${title} preview`} />
        ) : (
          <span className="sl-system-label">{hasAsset ? "Stored in R2" : "Empty"}</span>
        )}
      </div>

      <div className="brand-asset-copy">
        <span className="brand-upload-title">{title}</span>
        <span className="brand-upload-filename">{asset.filename}</span>
        <small>{guidance}</small>
      </div>

      {editable ? (
        <div className="brand-asset-actions">
          <form action={uploadBrandAssetAction} className="brand-upload-form">
            <input type="hidden" name="slot" value={slot} />
            <label className="brand-file-picker">
              <span>{hasAsset ? "Replace file" : "Choose file"}</span>
              <input name="file" type="file" accept={accept} required />
            </label>
            <PendingSubmitButton idle={hasAsset ? "Replace" : "Upload"} pending="Uploading…" />
          </form>
          {hasAsset ? (
            <form action={removeBrandAssetAction}>
              <input type="hidden" name="slot" value={slot} />
              <PendingSubmitButton idle="Remove" pending="Removing…" />
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default async function BrandSettingsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const { saved, uploaded, removed } = await searchParams;

  const { data: settings } = await supabase
    .from("company_brand_settings")
    .select("*")
    .eq("company_id", context.companyId)
    .single();

  if (!settings) throw new Error("Brand settings are unavailable");

  const editable = context.role === "senior";
  const colorFields = ["canvas", "surface", "raised", "line", "ink", "body", "slate", "dim", "accent", "edge"] as const;
  const darkInitial = {
    canvas: String(objectValue(settings.dark_colors, "canvas", "#0D0D1A")),
    surface: String(objectValue(settings.dark_colors, "surface", "#13131F")),
    raised: String(objectValue(settings.dark_colors, "raised", "#191926")),
    line: String(objectValue(settings.dark_colors, "line", "#22223A")),
    ink: String(objectValue(settings.dark_colors, "ink", "#FFFFFF")),
    body: String(objectValue(settings.dark_colors, "body", "#C4C4D2")),
    accent: String(objectValue(settings.dark_colors, "accent", "#E040C8")),
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header brand-settings-header">
        <div>
          <p className="sl-system-label page-eyebrow">Platform / Brand & Appearance</p>
          <h1 className="page-title">Brand & Appearance</h1>
          <p className="page-copy">
            Storyloop&apos;s shared visual identity. The existing token model remains the source of truth; this screen makes it understandable and safe to operate.
          </p>
        </div>
        <span className="brand-save-state sl-system-label">
          {saved ? "Saved" : uploaded ? "Asset saved" : removed ? "Asset removed" : "Changes persist on save"}
        </span>
      </header>

      {!editable ? (
        <p className="settings-notice">Junior access is read-only. Senior approval is required to change brand settings.</p>
      ) : null}

      <section className="settings-section settings-assets-section">
        <div className="settings-section-heading">
          <div>
            <h2>Identity assets</h2>
            <p className="settings-help">Stored in Cloudflare R2. Replace and remove actions update the existing metadata model.</p>
          </div>
        </div>
        <div className="brand-upload-grid">
          <UploadControl title="Primary logo" slot="primary_logo" metadata={settings.primary_logo_meta} editable={editable} accept="image/png,image/jpeg,image/webp" guidance="PNG, JPG or WebP. Keep a transparent master where possible." />
          <UploadControl title="Dark logo" slot="dark_logo" metadata={settings.dark_logo_meta} editable={editable} accept="image/png,image/jpeg,image/webp" guidance="For dark surfaces. PNG, JPG or WebP." />
          <UploadControl title="Light logo" slot="light_logo" metadata={settings.light_logo_meta} editable={editable} accept="image/png,image/jpeg,image/webp" guidance="For light surfaces. PNG, JPG or WebP." />
          <UploadControl title="Favicon" slot="favicon" metadata={settings.favicon_meta} editable={editable} accept="image/png,image/x-icon,image/vnd.microsoft.icon" guidance="PNG or ICO. Prefer a simple square mark." />
        </div>
      </section>

      <div className="brand-settings-workspace">
        <form id="brand-settings-form" action={saveBrandSettings} className="settings-form">
          <section className="settings-section">
            <h2>Theme</h2>
            <div className="settings-grid compact-settings-grid">
              <label>
                Default theme
                <select name="defaultTheme" defaultValue={settings.default_theme} disabled={!editable}>
                  <option value="dark">Dark — master</option>
                  <option value="light">Light — override</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h2>Dark theme</h2>
            <div className="brand-color-grid">
              {colorFields.map((key) => (
                <BrandColorControl
                  key={key}
                  label={key}
                  name={`dark_${key}`}
                  defaultValue={String(objectValue(settings.dark_colors, key, ""))}
                  disabled={!editable}
                />
              ))}
              <BrandColorControl
                label="ok"
                name="dark_ok"
                defaultValue={String(objectValue(settings.dark_colors, "ok", "#3ECF8E"))}
                disabled={!editable}
              />
            </div>
          </section>

          <section className="settings-section">
            <h2>Light override</h2>
            <div className="brand-color-grid">
              {colorFields.map((key) => (
                <BrandColorControl
                  key={key}
                  label={key}
                  name={`light_${key}`}
                  defaultValue={String(objectValue(settings.light_colors, key, ""))}
                  disabled={!editable}
                />
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h2>Gradient</h2>
            <div className="settings-grid">
              <label>Angle<input name="gradientAngle" type="number" min="0" max="360" defaultValue={Number(objectValue(settings.gradient, "angle", 135))} disabled={!editable}/></label>
              <BrandColorControl label="Start" name="gradientStart" defaultValue={String(objectValue(settings.gradient, "start", "#FF6B6B"))} disabled={!editable} />
              <BrandColorControl label="Middle" name="gradientMiddle" defaultValue={String(objectValue(settings.gradient, "middle", "#E040C8"))} disabled={!editable} />
              <BrandColorControl label="End" name="gradientEnd" defaultValue={String(objectValue(settings.gradient, "end", "#7B3FF5"))} disabled={!editable} />
            </div>
          </section>

          <section className="settings-section">
            <h2>Typography</h2>
            <div className="settings-grid">
              <label>Display font<select name="displayFamily" defaultValue={String(objectValue(settings.typography, "displayFamily", "Montserrat"))} disabled={!editable}><option>Montserrat</option><option>Exo 2</option></select></label>
              <label>Body font<select name="bodyFamily" defaultValue={String(objectValue(settings.typography, "bodyFamily", "Montserrat"))} disabled={!editable}><option>Montserrat</option><option>Exo 2</option></select></label>
              <label>System font<select name="systemFamily" defaultValue={String(objectValue(settings.typography, "systemFamily", "Exo 2"))} disabled={!editable}><option>Exo 2</option><option>Montserrat</option></select></label>
              <label>Display weight<input name="displayWeight" type="number" min="100" max="900" step="100" defaultValue={Number(objectValue(settings.typography, "displayWeight", 800))} disabled={!editable}/></label>
              <label>Title weight<input name="titleWeight" type="number" min="100" max="900" step="100" defaultValue={Number(objectValue(settings.typography, "titleWeight", 700))} disabled={!editable}/></label>
              <label>Body weight<input name="bodyWeight" type="number" min="100" max="900" step="100" defaultValue={Number(objectValue(settings.typography, "bodyWeight", 400))} disabled={!editable}/></label>
              <label>System weight<input name="systemWeight" type="number" min="100" max="900" step="100" defaultValue={Number(objectValue(settings.typography, "systemWeight", 700))} disabled={!editable}/></label>
              <label>System tracking<input name="systemLetterSpacing" defaultValue={String(objectValue(settings.typography, "systemLetterSpacing", "0.1em"))} disabled={!editable}/></label>
            </div>

            <div className="type-preview-stack">
              <div data-preview="display"><span>Display</span><strong>Storyloop</strong></div>
              <div data-preview="title"><span>Page title</span><strong>Campaign overview</strong></div>
              <div data-preview="body"><span>Body</span><p>Clear operational copy with restrained hierarchy and no decorative noise.</p></div>
              <div data-preview="system"><span>System label</span><strong>PLATFORM STATUS</strong></div>
              <div data-preview="stat"><span>KPI / stat</span><strong>₹24,000</strong></div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="heading-with-help">
              Spacing
              <ContextHelp text={adminHelp.systemField} label="About design-system token fields" />
            </h2>
            <p className="settings-help">The shared 4px-based scale is edited as constrained numeric tokens, not a raw comma-separated string.</p>
            <div className="spacing-token-grid">
              {settings.spacing.map((token, index) => (
                <label key={index}>
                  <span>{index + 1}</span>
                  <input name="spacingToken" type="number" min="1" step="1" defaultValue={token} disabled={!editable} />
                  <small>px</small>
                </label>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h2>Radii</h2>
            <div className="radius-grid">
              {(["Sm", "Md", "Lg"] as const).map((size) => {
                const key = size.toLowerCase();
                const value = objectValue(settings.radius, key, null);
                return (
                  <label key={size}>
                    <span className="radius-preview" style={{ borderRadius: value == null ? 0 : Number(value) }} />
                    <span>{size}</span>
                    <input name={`radius${size}`} type="number" min="0" defaultValue={value ?? ""} placeholder="TBD / unset" disabled={!editable} />
                  </label>
                );
              })}
            </div>
          </section>

          {editable ? (
            <div className="settings-actions brand-settings-actions">
              <span className="brand-unsaved-hint">Save applies the shared tokens across Admin.</span>
              <PendingSubmitButton idle="Save changes" pending="Saving…" className="primary-button" />
            </div>
          ) : null}
        </form>

        <BrandLivePreview formId="brand-settings-form" initial={darkInitial} />
      </div>
    </div>
  );
}
