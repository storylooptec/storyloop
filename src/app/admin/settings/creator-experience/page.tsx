import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveCreatorCmsItem } from "./actions";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function CreatorExperiencePage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const { saved } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("creator_cms_content")
    .select("*")
    .eq("company_id", context.companyId)
    .order("section")
    .order("label");

  if (error) throw new Error("Unable to load Creator CMS");

  const editable = context.role === "senior";
  const groups = new Map<string, NonNullable<typeof rows>>();

  for (const row of rows ?? []) {
    const group = groups.get(row.section) ?? [];
    group.push(row);
    groups.set(row.section, group);
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Platform / Creator Experience</p>
          <h1 className="page-title">Creator CMS</h1>
          <p className="page-copy">
            Manage approved Creator copy without changing the client-locked layout,
            navigation, consent rules or entitlement logic.
          </p>
        </div>
      </header>

      {saved ? <p className="settings-notice">Creator content saved.</p> : null}
      {!editable ? <p className="settings-notice">Junior access is read-only.</p> : null}

      {[...groups.entries()].map(([section, items]) => (
        <section className="settings-section creator-cms-section" key={section}>
          <h2>{section}</h2>
          <div className="creator-cms-list">
            {items.map((item) => (
              <form action={saveCreatorCmsItem} className="creator-cms-row" key={item.content_key}>
                <input type="hidden" name="key" value={item.content_key} />
                <div className="creator-cms-copy">
                  <strong>{item.label}</strong>
                  <code>{item.content_key}</code>
                </div>
                <textarea name="value" defaultValue={item.value} disabled={!editable} rows={3} />
                <label>
                  Visible
                  <select name="active" defaultValue={item.is_active ? "true" : "false"} disabled={!editable}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
                {editable ? <button className="secondary-button" type="submit">Save</button> : null}
              </form>
            ))}
          </div>
        </section>
      ))}

      <p className="settings-notice">
        CMS controls content only. Product structure remains governed by the client wireframes and Creator specification.
      </p>
    </div>
  );
}
