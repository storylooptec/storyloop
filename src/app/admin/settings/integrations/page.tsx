import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveIntegrationState } from "./actions";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function IntegrationsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const { saved } = await searchParams;

  const { data: integrations, error } = await supabase
    .from("company_integrations")
    .select("*")
    .eq("company_id", context.companyId)
    .order("category")
    .order("label");

  if (error) throw new Error("Unable to load integrations");

  const editable = context.role === "senior";

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / Integrations</p>
      <h1 className="page-title">Integrations</h1>
      <p className="page-copy">
        Provider registry and operating mode. Secrets remain in server environment
        variables; this screen stores only non-secret configuration and state.
      </p>

      {saved ? <p className="settings-notice">Integration state saved.</p> : null}

      <div className="integration-list">
        {(integrations ?? []).map((integration) => (
          <form
            action={saveIntegrationState}
            className="integration-row"
            key={integration.id}
          >
            <input type="hidden" name="providerKey" value={integration.provider_key} />

            <div>
              <span className="integration-category sl-system-label">
                {integration.category}
              </span>
              <strong>{integration.label}</strong>
              <code>{integration.provider_key}</code>
            </div>

            <div className="integration-state-control">
              <label>
                State
                <select
                  name="state"
                  defaultValue={integration.state}
                  disabled={!editable}
                >
                  <option value="disconnected">Disconnected</option>
                  <option value="mock">Mock</option>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                  <option value="error">Error</option>
                </select>
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
    </>
  );
}
