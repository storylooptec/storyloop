import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";

import { saveTemplate } from "./actions";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

function variablesToString(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter((item) => typeof item === "string").join(", ");
}

export default async function TemplatesPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const { saved } = await searchParams;

  const { data: templates, error } = await supabase
    .from("company_templates")
    .select("*")
    .eq("company_id", context.companyId)
    .order("label");

  if (error) throw new Error("Unable to load templates");

  const editable = context.role === "senior";

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / Templates</p>
      <h1 className="page-title">Templates</h1>
      <p className="page-copy">
        Central reusable message and document templates. System-generated or AI-assisted
        copy must still be reviewed by a person before anything is sent externally.
      </p>

      {saved ? <p className="settings-notice">Template saved.</p> : null}
      {!editable ? (
        <p className="settings-notice">
          Junior access is read-only. Senior approval is required to edit templates.
        </p>
      ) : null}

      <div className="template-list">
        {(templates ?? []).map((template) => (
          <form
            action={saveTemplate}
            className="template-card"
            key={template.id}
          >
            <input type="hidden" name="templateKey" value={template.template_key} />

            <header className="template-card-header">
              <div>
                <span className="sl-system-label template-channel">
                  {template.channel}
                </span>
                <h2>{template.label}</h2>
                <code>{template.template_key}</code>
              </div>

              <div className="template-status">
                <label>
                  Status
                  <select
                    name="isActive"
                    defaultValue={template.is_active ? "true" : "false"}
                    disabled={!editable}
                  >
                    <option value="false">Inactive</option>
                    <option value="true">Active</option>
                  </select>
                </label>
                <span className="template-review-badge">
                  Human review required
                  <ContextHelp text={adminHelp.humanReview} label="Why human review is required" />
                </span>
              </div>
            </header>

            <div className="template-fields">
              <label>
                Subject
                <input
                  name="subject"
                  defaultValue={template.subject ?? ""}
                  disabled={!editable}
                />
              </label>

              <label>
                Variables
                <input
                  name="variables"
                  defaultValue={variablesToString(template.variables)}
                  placeholder="creator_name, campaign_name"
                  disabled={!editable}
                />
              </label>

              <label className="template-body-field">
                Body
                <textarea
                  name="body"
                  defaultValue={template.body}
                  rows={7}
                  disabled={!editable}
                />
              </label>
            </div>

            {editable ? (
              <div className="template-actions">
                <button className="secondary-button" type="submit">
                  Save template
                </button>
              </div>
            ) : null}
          </form>
        ))}
      </div>
    </>
  );
}
