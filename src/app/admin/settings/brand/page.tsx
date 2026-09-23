import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveBrandSettings } from "./actions";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

function objectValue(value: unknown, key: string, fallback: string | number | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const result = (value as Record<string, unknown>)[key];
    if (typeof result === "string" || typeof result === "number") return result;
    if (result === null) return null;
  }
  return fallback;
}

export default async function BrandSettingsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const { saved } = await searchParams;

  const { data: settings } = await supabase
    .from("company_brand_settings")
    .select("*")
    .eq("company_id", context.companyId)
    .single();

  if (!settings) {
    throw new Error("Brand settings are unavailable");
  }

  const editable = context.role === "senior";

  const colorFields = [
    "canvas",
    "surface",
    "raised",
    "line",
    "ink",
    "body",
    "slate",
    "dim",
    "accent",
    "edge",
  ] as const;

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / Brand</p>
      <h1 className="page-title">Brand & Appearance</h1>
      <p className="page-copy">
        Shared Storyloop identity tokens. These values feed Admin now and later
        the Homepage, Creator and Company surfaces.
      </p>

      {saved ? <p className="settings-notice">Changes saved.</p> : null}
      {!editable ? (
        <p className="settings-notice">
          Junior access is read-only. Senior approval is required to change brand settings.
        </p>
      ) : null}

      <form action={saveBrandSettings} className="settings-form">
        <section className="settings-section">
          <h2>Identity</h2>
          <div className="settings-grid">
            <label>
              Default theme
              <select name="defaultTheme" defaultValue={settings.default_theme} disabled={!editable}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <div className="settings-upload-placeholder">
              <span>Primary logo</span>
              <strong>R2 upload activates in Step 7</strong>
            </div>
            <div className="settings-upload-placeholder">
              <span>Dark / light logos</span>
              <strong>R2 upload activates in Step 7</strong>
            </div>
            <div className="settings-upload-placeholder">
              <span>Favicon</span>
              <strong>R2 upload activates in Step 7</strong>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Dark theme</h2>
          <div className="settings-grid settings-grid-colors">
            {colorFields.map((key) => (
              <label key={key}>
                {key}
                <input
                  name={`dark_${key}`}
                  type="text"
                  defaultValue={String(objectValue(settings.dark_colors, key, ""))}
                  disabled={!editable}
                />
              </label>
            ))}
            <label>
              ok
              <input
                name="dark_ok"
                type="text"
                defaultValue={String(objectValue(settings.dark_colors, "ok", "#3ECF8E"))}
                disabled={!editable}
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Light theme</h2>
          <div className="settings-grid settings-grid-colors">
            {colorFields.map((key) => (
              <label key={key}>
                {key}
                <input
                  name={`light_${key}`}
                  type="text"
                  defaultValue={String(objectValue(settings.light_colors, key, ""))}
                  disabled={!editable}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>Gradient</h2>
          <div className="settings-grid">
            <label>Angle<input name="gradientAngle" type="number" defaultValue={Number(objectValue(settings.gradient, "angle", 135))} disabled={!editable}/></label>
            <label>Start<input name="gradientStart" defaultValue={String(objectValue(settings.gradient, "start", "#FF6B6B"))} disabled={!editable}/></label>
            <label>Middle<input name="gradientMiddle" defaultValue={String(objectValue(settings.gradient, "middle", "#E040C8"))} disabled={!editable}/></label>
            <label>End<input name="gradientEnd" defaultValue={String(objectValue(settings.gradient, "end", "#7B3FF5"))} disabled={!editable}/></label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Typography</h2>
          <div className="settings-grid">
            <label>Display font<select name="displayFamily" defaultValue={String(objectValue(settings.typography, "displayFamily", "Montserrat"))} disabled={!editable}><option>Montserrat</option><option>Exo 2</option></select></label>
            <label>Body font<select name="bodyFamily" defaultValue={String(objectValue(settings.typography, "bodyFamily", "Montserrat"))} disabled={!editable}><option>Montserrat</option><option>Exo 2</option></select></label>
            <label>System font<select name="systemFamily" defaultValue={String(objectValue(settings.typography, "systemFamily", "Exo 2"))} disabled={!editable}><option>Exo 2</option><option>Montserrat</option></select></label>
            <label>Display weight<input name="displayWeight" type="number" defaultValue={Number(objectValue(settings.typography, "displayWeight", 800))} disabled={!editable}/></label>
            <label>Title weight<input name="titleWeight" type="number" defaultValue={Number(objectValue(settings.typography, "titleWeight", 700))} disabled={!editable}/></label>
            <label>Body weight<input name="bodyWeight" type="number" defaultValue={Number(objectValue(settings.typography, "bodyWeight", 400))} disabled={!editable}/></label>
            <label>System weight<input name="systemWeight" type="number" defaultValue={Number(objectValue(settings.typography, "systemWeight", 700))} disabled={!editable}/></label>
            <label>System tracking<input name="systemLetterSpacing" defaultValue={String(objectValue(settings.typography, "systemLetterSpacing", "0.1em"))} disabled={!editable}/></label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Radius & spacing</h2>
          <div className="settings-grid">
            <label>Radius small<input name="radiusSm" type="number" defaultValue={objectValue(settings.radius, "sm", null) ?? ""} disabled={!editable}/></label>
            <label>Radius medium<input name="radiusMd" type="number" defaultValue={objectValue(settings.radius, "md", null) ?? ""} disabled={!editable}/></label>
            <label>Radius large<input name="radiusLg" type="number" defaultValue={objectValue(settings.radius, "lg", null) ?? ""} disabled={!editable}/></label>
            <label>Spacing tokens<input name="spacing" defaultValue={settings.spacing.join(", ")} disabled={!editable}/></label>
          </div>
        </section>

        {editable ? (
          <div className="settings-actions">
            <button type="submit" className="primary-button">Save changes</button>
          </div>
        ) : null}
      </form>
    </>
  );
}
