import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
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
    integrations,
    recentAudit,
  ] = await Promise.all([
    supabase
      .from("company_creators")
      .select("*", { count: "exact", head: true })
      .eq("company_id", context.companyId),
    supabase
      .from("company_integrations")
      .select("label,state,status_message")
      .eq("company_id", context.companyId),
    supabase
      .from("audit_logs")
      .select("id,action,status,created_at,entity_type")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(5),
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
            Management view of what is live today, what has no data yet, and what needs attention.
          </p>
        </div>
      </header>

      <section aria-labelledby="overview-summary-title">
        <h2 id="overview-summary-title" className="section-title">Platform & operations summary</h2>
        <div className="overview-metrics">
          <Metric label="Creators in roster" value={String(roster.count ?? 0)} detail="Live from company_creators." />
          <Metric label="Candidates in pool" value="No data yet" detail="Candidate persistence is not built in this repair." />
          <Metric label="Active brands" value="No data yet" detail="Operational brand records are not live yet." />
          <Metric label="Active campaigns" value="No data yet" detail="Campaign engine is intentionally out of scope." />
          <Metric label="Money in play" value="No data yet" detail="No live financial ledger exists yet." />
          <Metric label="Outstanding payouts" value="No data yet" detail="Payout execution is intentionally out of scope." />
          <Metric
            label="Integrations"
            value={failing.length ? `${failing.length} failing` : "No failures"}
            detail={`${live.length} live of ${integrationRows.length} registered.`}
          />
        </div>
      </section>

      <section className="overview-two-column">
        <div className="overview-block">
          <div className="overview-block-head">
            <h2 className="section-title">Operational analysis</h2>
            <span className="sl-system-label">Live-data aware</span>
          </div>
          <div className="overview-empty-analysis">
            <strong>No operational trend data yet</strong>
            <p>
              Campaign-state charts, creator growth, discovery funnel, SLA breaches and manual-minute trends will appear only when those live datasets exist.
            </p>
          </div>
        </div>

        <div className="overview-block">
          <div className="overview-block-head">
            <h2 className="section-title">Commercial analysis</h2>
            <span className="sl-system-label">No fabricated values</span>
          </div>
          <div className="overview-empty-analysis">
            <strong>No commercial ledger yet</strong>
            <p>
              Campaign value, payouts, gross margin, receivables ageing and float utilisation remain empty until real financial records exist.
            </p>
          </div>
        </div>
      </section>

      <section className="overview-block">
        <div className="overview-block-head">
          <h2 className="section-title">System health</h2>
          <span className="sl-system-label">Current foundation</span>
        </div>
        <div className="system-health-grid">
          <div>
            <span>Integration errors</span>
            <strong>{failing.length}</strong>
            <small>{failing.length ? failing.map((row) => row.label).join(", ") : "No provider is currently marked Error."}</small>
          </div>
          <div>
            <span>Failed jobs</span>
            <strong>No data yet</strong>
            <small>No jobs table exists in the current foundation.</small>
          </div>
          <div>
            <span>Pending KYC</span>
            <strong>No data yet</strong>
            <small>KYC engine is intentionally out of scope.</small>
          </div>
          <div>
            <span>Stale creator data</span>
            <strong>No data yet</strong>
            <small>Freshness analytics require populated creator operational data.</small>
          </div>
        </div>

        <div className="overview-audit">
          <h3>Recent privileged changes</h3>
          {recentAudit.data && recentAudit.data.length ? (
            <div className="simple-rows">
              {recentAudit.data.map((event) => (
                <div key={event.id}>
                  <span>{event.action} · {event.entity_type ?? "system"}</span>
                  <small>{new Date(event.created_at).toLocaleString()} · {event.status}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="overview-muted">No audit events recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
