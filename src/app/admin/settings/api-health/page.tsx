import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
}
function number(value: number | string | null) {
  return value === null ? null : Number(value);
}
function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1)];
}

export default async function ApiHealthPage() {
  await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await supabase.from("external_api_usage_events")
    .select("id,provider_key,operation,model,status,created_at,latency_ms,retry_count,cache_hit,estimated_cost_usd,billed_cost_usd,billed_cost_verified,failure_code")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error("Unable to load API usage events");

  const rows = events ?? [];
  const providers = [...new Set(rows.map((event) => event.provider_key))];
  const verifiedSpend = rows.reduce((sum, event) => sum + (event.billed_cost_verified ? number(event.billed_cost_usd) ?? 0 : 0), 0);
  const estimatedSpend = rows.reduce((sum, event) => sum + (number(event.estimated_cost_usd) ?? 0), 0);
  const billableEvents = rows.filter((event) => !event.cache_hit);
  const failures = rows.filter((event) => event.status === "failed" || event.status === "rate_limited").length;
  const latencies = rows.map((event) => event.latency_ms).filter((value): value is number => value !== null);

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / API health</p>
      <h1 className="page-title">API health & spend</h1>
      <p className="page-copy">Recent external provider calls, rate limits, latency and recorded cost. Billed totals include only amounts verified against provider billing data. Missing costs are shown as unreported, not zero.</p>

      <div className="overview-grid">
        <article className="overview-card"><span className="sl-system-label">Events loaded · last 30 days</span><strong>{rows.length}</strong><small>Latest 1,000 max · {billableEvents.length} non-cache attempts</small></article>
        <article className="overview-card"><span className="sl-system-label">Failures / limits</span><strong>{failures}</strong><small>Provider and app-side rate limits</small></article>
        <article className="overview-card"><span className="sl-system-label">Verified billed spend</span><strong>{money(verifiedSpend)}</strong><small>Loaded rows only; verified provider amounts</small></article>
        <article className="overview-card"><span className="sl-system-label">Estimated spend</span><strong>{estimatedSpend ? money(estimatedSpend) : "Not reported"}</strong><small>Loaded rows; based on configured rates</small></article>
        <article className="overview-card"><span className="sl-system-label">Latency · p50 / p95</span><strong>{percentile(latencies, 0.5) ?? "—"} / {percentile(latencies, 0.95) ?? "—"} ms</strong><small>Recent recorded provider calls</small></article>
      </div>

      <section className="settings-section">
        <h2>Provider status</h2>
        {providers.length ? providers.map((provider) => {
          const providerEvents = rows.filter((event) => event.provider_key === provider);
          const latest = providerEvents[0];
          const providerFailures = providerEvents.filter((event) => event.status === "failed" || event.status === "rate_limited").length;
          return (
            <article className="integration-row" key={provider}>
              <div><strong>{provider}</strong><code>{providerEvents.length} requests · {providerFailures} failures / limits</code></div>
              <div><strong>{latest?.status ?? "No data"}</strong><small>{latest ? new Date(latest.created_at).toLocaleString() : ""}</small></div>
            </article>
          );
        }) : <p className="settings-notice">No provider calls have been recorded in the last 30 days.</p>}
      </section>

      <section className="settings-section">
        <h2>Request history</h2>
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead><tr><th>When</th><th>Provider / operation</th><th>Result</th><th>Latency</th><th>Retries</th><th>Cost</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((event) => {
                const billed = number(event.billed_cost_usd);
                const estimated = number(event.estimated_cost_usd);
                return <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>{event.provider_key}<small>{event.operation}{event.model ? " · " + event.model : ""}</small></td>
                  <td>{event.status}{event.cache_hit ? " · cache" : ""}</td>
                  <td>{event.latency_ms === null ? "—" : event.latency_ms + " ms"}</td>
                  <td>{event.retry_count}</td>
                  <td>{event.billed_cost_verified && billed !== null ? money(billed) : estimated !== null ? "Est. " + money(estimated) : "Unreported"}</td>
                  <td>{event.failure_code ?? (event.billed_cost_verified ? "Billed verified" : "—")}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
