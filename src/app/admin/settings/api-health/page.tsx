import { storageConfigured } from "@/lib/storage/config";
import Link from "next/link";
import { permissions, roleHasPermission } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { dateRange, isUuid } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { higgsfieldConfiguration } from "@/lib/providers/higgsfield";
import { reconcileApiUsageAction } from "./actions";
import { ProviderBilling } from "./billing";

type Props = { searchParams: Promise<{ from?: string; to?: string; provider?: string; status?: string; company?: string; saved?: string; error?: string; bill?: string }> };
const providers = ["serpapi", "openai", "higgsfield", "r2", "supabase"] as const;
const statuses = ["started", "success", "failed", "rate_limited", "cached", "unknown"] as const;
const operatingRules = {
  serpapi: "3 competitor scans/company/UTC day; at most 7 discovery searches/scan. Tenant cache: 24 hours. Up to 2 network/5xx retries within 15 seconds total; stop on 429.",
  openai: "One active request/campaign. Timeouts: competitor extraction 30 seconds, brief 45 seconds, scripts 40 seconds. No automatic paid retry. Structured output and source validation required.",
  higgsfield: "Daily cap counts paid submissions. One active job/campaign. Quotes expire after 10 minutes; refresh status at most once every 10 seconds. 20-second API timeout; uncertain submissions reuse the original request only.",
  r2: "Paused. Historical usage and invoices remain available; new files use Supabase Storage.",
  supabase: "Private Storage: logos/photos 5 MB, generated images 15 MB, videos 50 MB (project limits may be lower). Tenant and consent checks run before storage access. Tenant data access enforced by RLS and checked RPCs. Provider telemetry is server-write-only. Budgets reserve cost before external calls; unknown or missing cost blocks work when a spend cap is set.",
} as const;
function environmentEnabled(provider: typeof providers[number]) {
  return provider === "serpapi" ? process.env.SERP_API_ENABLED === "true"
    : provider === "higgsfield" ? process.env.HIGGSFIELD_API_ENABLED === "true"
    : provider === "openai" ? process.env.OPENAI_API_ENABLED !== "false" : provider !== "r2";
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(value); }
function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1)];
}
function configuredProviders() {
  const combinedHiggsfieldKey = process.env.HIGGSFIELD_API_KEY?.trim().replace(/^Key\s+/i, "");
  const higgsfieldId = process.env.HIGGSFIELD_API_KEY_ID?.trim();
  const higgsfieldSecret = process.env.HIGGSFIELD_API_KEY_SECRET?.trim();
  return {
    serpapi: Boolean(process.env.SERP_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY),
    higgsfield: Boolean((combinedHiggsfieldKey && /^[^:\s]+:[^:\s]+$/.test(combinedHiggsfieldKey)) || (higgsfieldId && higgsfieldSecret && !/[\s:]/.test(higgsfieldId + higgsfieldSecret))),
    r2: false,
    supabase: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY && storageConfigured()),
  };
}

export default async function ApiHealthPage({ searchParams }: Props) {
  const [context, params] = await Promise.all([requirePermission(permissions.operationsWork), searchParams]);
  const supabase = await createServerSupabaseClient();
  const range = dateRange(params.from, params.to);
  const provider = providers.find((item) => item === params.provider);
  const status = statuses.find((item) => item === params.status);
  const companyId = params.company && isUuid(params.company) ? params.company : "";
  const configured = configuredProviders();
  const previewConfiguration = higgsfieldConfiguration();
  let query = supabase.from("external_api_usage_events")
    .select("id,company_id,campaign_id,provider_key,operation,model,status,created_at,completed_at,latency_ms,retry_count,cache_hit,input_units,output_units,unit_type,estimated_cost_usd,billed_cost_usd,billed_cost_verified,failure_code,provider_request_id,billing_reference,reconciled_at", { count: "exact" })
    .gte("created_at", `${range.from}T00:00:00.000Z`).lt("created_at", range.until).order("created_at", { ascending: false }).limit(500);
  if (provider) query = query.eq("provider_key", provider);
  if (status) query = query.eq("status", status);
  if (companyId) query = query.eq("company_id", companyId);
  const [{ data: events, error, count: total }, { data: policies }] = await Promise.all([query, supabase.from("api_provider_policies").select("provider_key,enabled,daily_company_limit,hourly_campaign_limit,daily_budget_usd,consecutive_failures,blocked_until")]);
  if (error) throw new Error("Unable to load API usage events");
  const rows = events ?? [];
  const verified = rows.filter((event) => event.billed_cost_verified && event.billed_cost_usd !== null);
  const estimated = rows.filter((event) => event.estimated_cost_usd !== null);
  const failures = rows.filter((event) => event.status === "failed" || event.status === "rate_limited").length;
  const latencies = rows.map((event) => event.latency_ms).filter((value): value is number => value !== null);
  const canReconcile = roleHasPermission(context.role, permissions.financialActionsPerform);
  return <>
    <p className="sl-system-label page-eyebrow">Platform / API health</p><h1 className="page-title">API health & spend</h1>
    <p className="page-copy">Recorded external calls, timing, usage and cost. Estimates and verified billing remain separate. All timestamps and date filters use UTC. Provider configuration shows only whether credentials are present.</p>
    {params.saved ? <p className="settings-notice" role="status">Provider billing recorded and audit logged.</p> : null}
    {params.error ? <p className="settings-notice" role="alert">Billing could not be reconciled. Enter the provider-verified amount and invoice reference for a completed request, and confirm verification.</p> : null}
    <section className="settings-section"><form className="settings-form"><div className="settings-grid">
      <label>Provider<select name="provider" defaultValue={provider ?? ""}><option value="">All providers</option>{providers.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Result<select name="status" defaultValue={status ?? ""}><option value="">All results</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Company ID<input name="company" defaultValue={companyId} placeholder="All companies" pattern="[0-9a-fA-F-]{36}" /></label>
      <label>From (UTC)<input type="date" name="from" defaultValue={range.from} /></label><label>Through (UTC)<input type="date" name="to" defaultValue={range.to} /></label>
    </div><button className="secondary-button">Apply filters</button></form></section>
    <div className="overview-grid">
      <article className="overview-card"><span className="sl-system-label">Events shown</span><strong>{rows.length} / {total ?? rows.length}</strong><small>Latest 500 max; all cards summarize shown rows</small></article>
      <article className="overview-card"><span className="sl-system-label">Failures / limits</span><strong>{failures}</strong><small>{rows.filter((event) => event.status === "unknown").length} outcomes unknown · {rows.filter((event) => event.status === "started").length} in progress</small></article>
      <article className="overview-card"><span className="sl-system-label">Verified billed spend</span><strong>{verified.length ? money(verified.reduce((sum, event) => sum + Number(event.billed_cost_usd), 0)) : "Not reconciled"}</strong><small>{verified.length} of {rows.length} events reconciled</small></article>
      <article className="overview-card"><span className="sl-system-label">Estimated spend</span><strong>{estimated.length ? money(estimated.reduce((sum, event) => sum + Number(event.estimated_cost_usd), 0)) : "Unreported"}</strong><small>{estimated.length} of {rows.length} events have an estimate</small></article>
      <article className="overview-card"><span className="sl-system-label">Latency · p50 / p95</span><strong>{percentile(latencies, 0.5) ?? "—"} / {percentile(latencies, 0.95) ?? "—"} ms</strong><small>{latencies.length} recorded durations</small></article>
    </div>
    <section className="settings-section"><h2>Provider status</h2><p className="page-copy">Latest observed result within the filters. A configured key or an absence of failures does not establish provider health.</p>{!previewConfiguration.ready ? <p className="settings-notice">Higgsfield setup: {previewConfiguration.reason}</p> : null}{providers.map((key) => {
      const latest = rows.find((event) => event.provider_key === key && !event.cache_hit
        && !(event.status === "rate_limited" && event.latency_ms === null));
      const policy = policies?.find((item) => item.provider_key === key);
      return <article className="integration-row" key={key}><div><strong>{key}</strong><code>{key === "r2" ? "Paused — files use Supabase" : `Credentials: ${configured[key] ? "configured" : "missing"}`}</code><small>{!environmentEnabled(key) ? "Disabled in environment" : policy ? (policy.enabled ? "Database policy enabled" : "Paused by database policy") : "Infrastructure integration"}</small></div><div><strong>{latest ? `Last result: ${latest.status}` : "No requests in filtered period"}</strong><small>{latest ? new Date(latest.created_at).toLocaleString("en-IN", { timeZone: "UTC" }) + " UTC" : "Health unverified"}</small>{policy ? <small>{policy.daily_company_limit}/company/day · {policy.hourly_campaign_limit}/campaign/hour · Budget {policy.daily_budget_usd === null ? "not configured" : money(Number(policy.daily_budget_usd)) + "/company/day"}<br />{policy.consecutive_failures} consecutive failures{policy.blocked_until ? " · pause deadline " + new Date(policy.blocked_until).toLocaleString("en-IN", { timeZone: "UTC" }) + " UTC" : ""}</small> : null}</div></article>;
    })}</section>
    <section className="settings-section"><h2>API operating rules</h2><p className="page-copy">These are Storyloop limits. Vendor account quotas are separate and must be checked in each provider dashboard. Five consecutive errors pause a provider for five minutes; a provider rate-limit response sets its cooldown. Daily limits reset at midnight UTC (05:30 IST).</p><div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Provider</th><th>Timeouts, retries, caching and access</th></tr></thead><tbody>{providers.map(key => <tr key={key}><td>{key}</td><td>{operatingRules[key]}</td></tr>)}</tbody></table></div><p className="page-copy">SerpApi and OpenAI prices come from server configuration; unavailable estimates remain unreported. Higgsfield uses a current quote and requires explicit cost acceptance. Infrastructure invoices are reconciled separately. Credentials and feature flags do not prove live provider health.</p><p className="page-copy">Supabase credential readiness includes the server-only secret/service-role key required for trusted writes. No credential values appear here.</p></section>
    <section className="settings-section"><h2>Request history</h2><p className="page-copy">Reconcile only a provider-verified request amount. Do not assign a whole subscription invoice to each call. Subscription allocations remain estimates.</p><div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>When (UTC)</th><th>Provider / operation</th><th>Result</th><th>Usage / request ID</th><th>Latency / retries</th><th>Estimated / billed</th><th>Company / campaign</th><th>Reconciliation</th></tr></thead><tbody>{rows.map((event) => <tr key={event.id}>
      <td>{new Date(event.created_at).toLocaleString("en-IN", { timeZone: "UTC" })}<small>{event.completed_at ? "Finished " + new Date(event.completed_at).toLocaleTimeString("en-IN", { timeZone: "UTC" }) : ""}</small></td>
      <td>{event.provider_key}<small>{event.operation}{event.model ? " · " + event.model : ""}</small></td><td>{event.status}{event.cache_hit ? " · cache" : ""}<small>{event.failure_code}</small></td>
      <td>{event.input_units ?? "—"} in / {event.output_units ?? "—"} out<small>{event.unit_type ?? "Units unreported"}</small><small>{event.provider_request_id ?? "No provider request ID"}</small></td>
      <td>{event.latency_ms === null ? "—" : event.latency_ms + " ms"}<small>{event.retry_count} retries</small></td>
      <td>Est. {event.estimated_cost_usd === null ? "unreported" : money(Number(event.estimated_cost_usd))}<small>Billed {event.billed_cost_verified && event.billed_cost_usd !== null ? money(Number(event.billed_cost_usd)) : "unreconciled"}</small></td>
      <td>{event.company_id ?? "Platform"}<small>{event.campaign_id ?? "—"}</small></td>
      <td>{event.billing_reference ? <><strong>{event.billing_reference}</strong><small>{event.reconciled_at ? new Date(event.reconciled_at).toLocaleString("en-IN", { timeZone: "UTC" }) + " UTC" : ""}</small></> : null}{canReconcile && event.status !== "started" ? <details><summary>{event.billed_cost_verified ? "Correct billing" : "Verify billing"}</summary><form action={reconcileApiUsageAction} className="settings-form"><input type="hidden" name="event_id" value={event.id} /><label>Verified cost (USD)<input name="billed_cost_usd" type="number" min="0" max="999999" step="0.000001" defaultValue={event.billed_cost_usd ?? ""} required /></label><label>Provider invoice / line reference<input name="billing_reference" minLength={3} maxLength={500} defaultValue={event.billing_reference ?? ""} required /></label><label><input type="checkbox" name="verified" required /> I verified this request amount against provider billing.</label><button className="secondary-button">Record verified amount</button></form></details> : <small>{canReconcile ? "Wait for request outcome" : "Senior finance permission required"}</small>}</td>
    </tr>)}</tbody></table></div>{!rows.length ? <p className="settings-notice">No requests match these filters. No health or spending conclusion can be drawn yet.</p> : null}</section>
    <ProviderBilling from={range.from} to={range.to} provider={provider} canRecord={canReconcile} result={params.bill} requestFiltersActive={Boolean(status || companyId)} />
    <p><Link href="/admin/settings/campaign-metrics">Manage campaign performance measurements →</Link></p>
  </>;
}
