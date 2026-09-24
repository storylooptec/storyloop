import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="overview-metric">
      <span className="sl-system-label">{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}

export default async function AdminOverviewPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const [
    roster,
    accounts,
    incomplete,
    paid,
    exclusive,
    studioReady,
    studioRevoked,
    integrations,
    audit,
  ] = await Promise.all([
    supabase.from("company_creators").select("*", { count: "exact", head: true }).eq("company_id", context.companyId),
    supabase.from("creator_accounts").select("*", { count: "exact", head: true }).eq("company_id", context.companyId),
    supabase.from("creator_accounts").select("*", { count: "exact", head: true }).eq("company_id", context.companyId).eq("onboarding_completed", false),
    supabase.from("creator_accounts").select("*", { count: "exact", head: true }).eq("company_id", context.companyId).eq("tier", "paid"),
    supabase.from("creator_accounts").select("*", { count: "exact", head: true }).eq("company_id", context.companyId).eq("tier", "exclusive"),
    supabase.from("creator_studio_profiles").select("creator_id", { count: "exact", head: true }).eq("setup_status", "ready"),
    supabase.from("creator_studio_profiles").select("creator_id", { count: "exact", head: true }).eq("setup_status", "revoked"),
    supabase.from("company_integrations").select("label,state,status_message").eq("company_id", context.companyId),
    supabase.from("audit_logs").select("id,action,status,created_at,entity_type").eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(5),
  ]);

  const integrationRows = integrations.data ?? [];
  const failing = integrationRows.filter((row) => row.state === "error");
  const live = integrationRows.filter((row) => row.state === "live");

  return (
    <div className="admin-page overview-page">
      <header className="admin-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Storyloop / Management</p>
          <h1 className="page-title">Overview</h1>
          <p className="page-copy">
            Live management view of Creator supply, onboarding, entitlements and platform health.
          </p>
        </div>
      </header>

      <section>
        <h2 className="section-title">Creator & platform summary</h2>
        <div className="overview-metrics">
          <Metric label="Creators in roster" value={String(roster.count ?? 0)} detail="Completed Creator relationships." />
          <Metric label="Creator accounts" value={String(accounts.count ?? 0)} detail="Includes onboarding in progress." />
          <Metric label="Incomplete onboarding" value={String(incomplete.count ?? 0)} detail="Needs completion before listing." />
          <Metric label="Paid creators" value={String(paid.count ?? 0)} detail="Live entitlement state." />
          <Metric label="Exclusive creators" value={String(exclusive.count ?? 0)} detail="Managed overlay enabled." />
          <Metric label="Studio ready" value={String(studioReady.count ?? 0)} detail="Likeness setup marked ready." />
          <Metric label="Studio revoked" value={String(studioRevoked.count ?? 0)} detail="Generation must stay blocked." />
          <Metric label="Integrations" value={failing.length ? String(failing.length) + " failing" : "No failures"} detail={String(live.length) + " live of " + String(integrationRows.length) + " registered."} />
        </div>
      </section>

      <section className="overview-two-column">
        <div className="overview-block">
          <h2 className="section-title">Creator operations</h2>
          <dl className="detail-list">
            <div><dt>Accounts started</dt><dd>{accounts.count ?? 0}</dd></div>
            <div><dt>Listed</dt><dd>{roster.count ?? 0}</dd></div>
            <div><dt>Incomplete</dt><dd>{incomplete.count ?? 0}</dd></div>
            <div><dt>Studio ready</dt><dd>{studioReady.count ?? 0}</dd></div>
          </dl>
        </div>

        <div className="overview-block">
          <h2 className="section-title">Commercial analysis</h2>
          <div className="overview-empty-analysis">
            <strong>No campaign ledger yet</strong>
            <p>Campaign value, payouts, margin, receivables and creator earnings stay empty until real campaign/payment records exist.</p>
          </div>
        </div>
      </section>

      <section className="overview-block">
        <div className="overview-block-head">
          <h2 className="section-title">System health</h2>
          <span className="sl-system-label">Live foundation</span>
        </div>
        <div className="system-health-grid">
          <div><span>Integration errors</span><strong>{failing.length}</strong><small>{failing.length ? failing.map((row) => row.label).join(", ") : "No provider is currently marked Error."}</small></div>
          <div><span>Creator onboarding issues</span><strong>{incomplete.count ?? 0}</strong><small>Accounts not yet listed.</small></div>
          <div><span>Likeness revoked</span><strong>{studioRevoked.count ?? 0}</strong><small>Studio generation must remain blocked.</small></div>
          <div><span>Campaign/KYC alerts</span><strong>No data yet</strong><small>These become live with campaign acceptance and KYC engines.</small></div>
        </div>

        <div className="overview-audit">
          <h3>Recent privileged changes</h3>
          {audit.data && audit.data.length ? (
            <div className="simple-rows">
              {audit.data.map((event) => (
                <div key={event.id}>
                  <span>{event.action} · {event.entity_type ?? "system"}</span>
                  <small>{new Date(event.created_at).toLocaleString()} · {event.status}</small>
                </div>
              ))}
            </div>
          ) : <p className="overview-muted">No audit events recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
