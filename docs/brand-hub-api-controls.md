# Brand Hub Phase 1 — provider controls

This is the implementation contract for external calls in the Brand Hub. Provider keys stay server-side. No provider request runs directly from a browser.

## Provider policy

| Provider | Use | App-side guardrails | Cache / evidence | Admin telemetry |
|---|---|---|---|---|
| SerpApi (serpapi.com) | Google Search for top competitor candidates and public-source discovery | One in-flight scan per campaign; 3 scans per brand per UTC calendar day; bounded concurrency; stop on 429/quota response; retry 429/5xx at most twice with backoff | Cache normalized query + country/language for 24h. Persist each scan and source URL/date so deltas compare stored snapshots. Do not assert competitor spend as fact. | Search engine, query hash, scan/campaign/company, status, latency, cache hit, retry count, result count and estimated cost; no API key |
| OpenAI API | JSON-structured evidence synthesis, brief drafts and script variants from approved evidence | Server-side only; one generation request at a time per campaign; default maximum 5 generation attempts per campaign per hour; explicit regenerate action; validate structured output before storing | Model output is not evidence. Every factual insight must refer to a saved source ID; reject unsupported claims. Store model/version and usage counts, not credentials. | Model, request type, input/output tokens, status, latency, retries and estimated cost, distinguished from provider-billed cost |
| Higgsfield API | Optional AI image/video preview after an explicit user request and recorded creator approval | No automatic generation. Maximum 2 preview submissions per campaign per day and 1 active job per campaign. Respect provider concurrency/quota responses; do not retry a submitted render blindly. | Store job ID/status and generated asset key. Watermark previews and keep the creator-consent reference. | Model, job ID, campaign, status, duration, estimated credits/cost, completion/failure; never log media bytes or credentials |
| Cloudflare R2 | Brand logos and approved campaign media | Reuse the existing server-side R2 uploader; 5 MB maximum; allowlisted image MIME types and signature checks; delete orphaned objects after DB-write failures | Keep object keys in Supabase; use immutable cache headers for versioned assets. Never expose R2 secret credentials in client bundles. | Upload/delete operation, bytes, content type, status, duration and object key (no signed URL or secret) |
| Supabase | Authenticated application data and RLS | RLS on all new public-schema tables; use the user session for brand operations; no service-role key in browser code | Persist campaign inputs, scan snapshots, source dates, approvals, and measured report events. Do not mix demo creators with live creator records or benchmarks. | Database failures and request IDs; avoid logging full prompts or personal data |

## Error, retry and spend rules

- Apply a server-side request timeout; return a user-readable retry state without revealing provider error bodies.
- Retry only transient 429/5xx/timeouts, with a maximum of two retries and exponential backoff plus jitter. Never automatically repeat an asynchronous media submission when its acceptance is uncertain.
- Enforce the app-side caps above per company/campaign and add a global provider circuit breaker. Return cached results when valid; otherwise explain that the scan is temporarily unavailable.
- Store a unique idempotency key for each scan/generation intent. A double click must not create duplicate paid jobs.
- Report estimated cost separately from provider-billed cost; only mark billed cost verified when reconciled with a vendor invoice/export. Do not invent pricing.
- Admin API Health should show provider, operation/model, calls, success/error rate, p50/p95 latency, retries, cache hits, input/output units, estimated cost, billed cost, period, and per-company/campaign filters. Alert when a provider is failing, approaching the configured quota, or exceeding the spend cap.
- Never store API keys, full prompts, full search result payloads, signed URLs, or uploaded media bytes in telemetry. Keep source snippets short and attributable.

## Configuration

Provider-specific hard quotas and prices depend on the account tier and must be entered/verified in the Admin Integrations screen. The app-side limits above are conservative product controls, not claims about provider plan limits. External provider calls remain disabled until the relevant server environment variable is present and an administrator has enabled the integration.
