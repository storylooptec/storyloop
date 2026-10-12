# Brand Hub Phase 1 — implemented provider controls

Keys and external calls stay on the server. Limits below are Storyloop application controls, not the vendor's account-tier limits. Check each vendor dashboard before enabling a production integration. The database policy and environment feature flag must both permit a paid operation.

## Requests, limits and evidence

| Provider | Implemented use | Default application limits | Timeout / retry / cache |
|---|---|---|---|
| SerpApi | Google discovery, official-domain verification, indexed Reddit excerpts, Amazon product search and explicitly selected product details / partial reviews | 30 uncached searches per company per UTC day; 30 per campaign per hour; separate 3 competitor scans per company per UTC day; one active provider operation per campaign | Up to 3 attempts for network/5xx only, with backoff and jitter; 8-second attempt ceiling within a 15-second total; no 429 retry. Tenant-scoped sanitized cache for 24 hours. Full scan has a 150-second work budget. |
| OpenAI | Cited competitor entity extraction, editable brief generation, three script concepts | 100 attempts per company per UTC day; 5 per campaign per hour; one active operation per campaign | Single bounded request: 45 seconds for brief, 30 seconds for competition extraction, 40 seconds for scripts. No automatic retry of billable generation. Explicit regenerate action. |
| Higgsfield | Optional generic image / five-second silent video; creator-likeness image only with recorded consent | 2 paid submissions per company per UTC day; 60 operations per campaign per hour including quotes/status; one active job per campaign; poll interval at least 10 seconds | 20-second API timeout. Quote expires after 10 minutes. No blind retry after uncertain submission; recovery reuses the original frozen body and idempotency key while the original quote remains valid. |
| Cloudflare R2 | Brand logos, consent reference photos, generated previews | Logos and reference photos: 5 MB; archived generated images: 15 MB; videos: 64 MB. Allowed types and signatures checked. | AWS SDK transport behavior; no application-level blind re-upload. Private media download: 45 seconds, exact allowed host, HTTPS, public DNS addresses, no redirects. Photos/previews use a private bucket and authorized serving routes. |
| Supabase | Auth, workspace/campaign state, RLS, catalog/rates, report metrics, telemetry and invoice records | Provider reservations are serialized in database transactions; tenant IDs are enforced in RLS and composite foreign keys | User clients perform ordinary authorized work. A server-only privileged client handles narrow provider writes after membership/campaign checks. No service key is sent to the browser. |

A competitor scan uses two discovery searches and at most five official-domain checks. A search result alone is not a confirmed competitor. Users confirm candidates before their evidence is used for plans. Marketplaces and publishers are excluded from competitor identities. Manual corrections require a domain and are limited to five non-rejected competitors.

Customer evidence is a set of dated observations, not a representative sentiment survey. Amazon snippets are partial, and a product must be selected before review collection. Competitor spend, market share and unsupported performance estimates remain unavailable. Changes compare stored observations and source snapshots. Model output is never itself treated as evidence. Brief facts reference saved observation IDs; pain claims require customer evidence. Editing or changing supporting competitor evidence invalidates downstream approvals.

## Failure, concurrency and spend behavior

- `api_provider_policies` contains enablement, daily company cap, hourly campaign cap, optional daily USD budget per company, failure count and circuit expiry. Trusted operators can configure it through controlled SQL; the Admin page displays these policies.
- Every external paid operation reserves a telemetry row before making its request. Unique intent keys and row locks prevent duplicate reservations. A stale reservation becomes `unknown` after five minutes when the provider is next reserved.
- A provider 429 opens a temporary circuit, bounded to one hour. Five consecutive failures/unknown outcomes pause the provider for five minutes. Success clears the failure count. Vendor hard quotas remain authoritative even below Storyloop's caps.
- A configured daily USD budget fails closed when a cost estimate is absent or prior potentially billable operations remain uncosted. Reservations count toward the cap while work runs. Uncertain acceptance is not treated as a free failure.
- SerpApi unit estimates and OpenAI token prices come from the server environment. Use prices for the configured model/account and update them when the contract changes. No prices are invented. Higgsfield uses its estimate endpoint and the configured maximum price per preview.
- Estimates, reconciled request charges, and subscription/infrastructure invoices are separate. Request estimates must not be added to their reconciled costs, and request costs must not be added to invoices that already include them.
- Cached search reads create zero-additional-cost telemetry without spending a provider request or using its network quota.

## Creator consent and preview media

Approval is tied to the selected creator, campaign, saved script revision, exact prompt, and SHA-256 of the uploaded reference. The creator signs in to `/creator/brand-requests`; consent expires after seven days and can be revoked. Changing the creative invalidates old approval. Generic previews require no creator identity. Creator-likeness video is not enabled in this release.

Submission requires a current quote and explicit cost acceptance. An ambiguous job can be recovered only with the original request; after quote expiry it needs provider-side reconciliation before any new job is submitted. Successful media is archived to R2. A completed provider job with failed archival remains retryable without generating again. Revoked/expired consent blocks access to affected creator preview media. The UI labels outputs as AI previews; this release does not burn a watermark into the media bytes.

## Admin health and spending

`/admin/settings/api-health` shows request status, provider, company, campaign, time, latency, units, retries, cache hits, request IDs, policy state and configuration booleans. It uses a bounded 500-row window and labels that limit; aggregate numbers describe those loaded rows. A healthy-looking historical row does not prove the provider is reachable now. No paid synthetic health probe runs in the background.

Authorized Storyloop finance users can reconcile a request charge against a vendor export, or record an invoice with a native USD amount, billing period, invoice reference, incurred/paid dates and verification. Both paths create audit events. Monthly SerpApi subscriptions and R2/Supabase bills belong in the invoice ledger. Vendor billing is not automatically imported in this release. Unknown costs remain explicitly unreconciled rather than becoming zero.

R2 upload/delete/archive operations and campaign creation are instrumented as logical infrastructure operations. Every database query, object GET and local signed-URL calculation is not counted as an API charge; invoices remain the source of actual infrastructure spending. Telemetry excludes keys, full prompts, signed URLs, media bytes and raw provider responses.

## Configuration

Use `.env.example` and `docs/brand-hub-release.md`. `SERP_API_ENABLED` and `HIGGSFIELD_API_ENABLED` default to false. OpenAI is enabled unless `OPENAI_API_ENABLED=false`, but still requires a server key and enabled database policy. Credentials alone do not establish provider health. None of these controls replaces the provider's terms, account quotas or billing dashboard.
