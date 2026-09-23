import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";

import { saveConfigurationItem } from "./actions";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "";
}

export default async function ConfigurationPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const { saved } = await searchParams;

  const { data: rows, error } = await supabase
    .from("company_configuration")
    .select("*")
    .eq("company_id", context.companyId)
    .order("category")
    .order("label");

  if (error) throw new Error("Unable to load configuration");

  const editable = context.role === "senior";
  const groups = new Map<string, typeof rows>();

  for (const row of rows ?? []) {
    const group = groups.get(row.category) ?? [];
    group.push(row);
    groups.set(row.category, group);
  }

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / Configuration</p>
      <div className="page-title-with-help">
        <h1 className="page-title">Configuration</h1>
        <ContextHelp text={adminHelp.configurationValue} label="About configuration values" />
      </div>
      <p className="page-copy">
        Product rules and feature switches that should change without a code deploy.
        Unresolved product decisions stay explicitly marked TBD.
      </p>

      {saved ? <p className="settings-notice">Configuration saved.</p> : null}
      {!editable ? (
        <p className="settings-notice">
          Junior access is read-only. Senior approval is required to change configuration.
        </p>
      ) : null}

      <div className="configuration-groups">
        {[...groups.entries()].map(([category, items]) => (
          <section className="settings-section" key={category}>
            <h2 className="configuration-category">{category}</h2>

            <div className="configuration-list">
              {items.map((item) => (
                <form
                  action={saveConfigurationItem}
                  className="configuration-row"
                  key={item.id}
                >
                  <input type="hidden" name="key" value={item.key} />
                  <input type="hidden" name="valueType" value={item.value_type} />

                  <div className="configuration-copy">
                    <div className="configuration-title-line">
                      <strong>{item.label}</strong>
                      {item.is_tbd ? (
                        <span className="inline-help-label">
                          <span className="configuration-tbd sl-system-label">TBD</span>
                          <ContextHelp text={adminHelp.tbd} label="What TBD means" />
                        </span>
                      ) : null}
                    </div>
                    {item.description ? <p>{item.description}</p> : null}
                    <span className="technical-field">
                      <code>{item.key}</code>
                      <ContextHelp text={adminHelp.systemField} label="About this system field" />
                    </span>
                  </div>

                  <div className="configuration-editor">
                    <label>
                      State
                      <select
                        name="isTbd"
                        defaultValue={item.is_tbd ? "true" : "false"}
                        disabled={!editable}
                      >
                        <option value="true">TBD</option>
                        <option value="false">Set value</option>
                      </select>
                    </label>

                    <label>
                      Value
                      {item.value_type === "boolean" ? (
                        <select
                          name="value"
                          defaultValue={displayValue(item.value) || "false"}
                          disabled={!editable}
                        >
                          <option value="true">On</option>
                          <option value="false">Off</option>
                        </select>
                      ) : (
                        <input
                          name="value"
                          type={item.value_type === "string" ? "text" : "number"}
                          step={item.value_type === "number" ? "any" : "1"}
                          defaultValue={displayValue(item.value)}
                          disabled={!editable}
                        />
                      )}
                    </label>

                    {editable ? (
                      <button className="secondary-button" type="submit">
                        Save
                      </button>
                    ) : null}
                  </div>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
