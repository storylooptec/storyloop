# Brand Hub Phase 1 release

## What this release contains

Brand registration and email/password or email-code login; verified-email workspace creation; campaign inputs and R2 logo upload; integrated competitor research and confirmation; dated evidence and comparisons; editable, revision-safe brief approval; curated Discover and rate snapshots; deterministic INR budget totals and historical benchmarks; script generation/editing/approval; optional consent-controlled image/video previews; campaign launch/completion records; measured Reports; Admin API health, billing reconciliation, invoice ledger and daily campaign metrics entry.

Discover starts empty. Publishing a creator requires an actual creator record, directory consent, approved public fields and Storyloop rates. Campaign creation and generic creative development remain available while the catalog is empty. Benchmarks remain unavailable until at least five suitable completed campaigns exist for every selected format. Reports stay empty until real post-launch daily measurements are recorded.

No social publishing, automatic invoice import, paid platform spend lookup, continuous polling daemon or platform analytics ingestion is included. Reports read the database and the Admin measurement form is the initial ingestion path. Source data, not an AI estimate, determines performance.

## Verification on this branch

- TypeScript and repository ESLint pass.
- `npm test`: 47 passing checks, including 19 SQL integration scenarios on real PostgreSQL semantics through PGlite.
- Next production build succeeds with local fixture configuration.
- Browser smoke tests use local deterministic Supabase fixtures and disable every external generation/search provider. They check login routing, eight authenticated pages, seven mobile layouts, draft validation/submission and uncaught page errors.
- The PostgreSQL fixture is single-session: overlapping queued reservations exercise gate behavior, not a production multi-connection contention benchmark.
- Provider contract tests mock network responses. No paid SerpApi, OpenAI or Higgsfield calls were made during development. Real email delivery, live R2, deployed RLS and real account quotas still require release verification.

## Database release order

Target project discussed: `bgmjjqaxjusrvkiwykma`. No remote migration was applied during this development pass. Take a database backup/check restore availability and inspect the remote migration ledger before applying the following pending files in order:

1. `20261012000100_brand_hub_foundation.sql`
2. `20261012000200_brand_campaign_plans.sql`
3. `20261012000300_brand_campaign_creatives.sql`
4. `20261012174332_brand_provider_runtime.sql`
5. `20261012174333_brand_competition_evidence.sql`
6. `20261012174339_brand_planning_catalog.sql`
7. `20261012174348_brand_creative_previews.sql`
8. `20261012174356_brand_campaign_reporting.sql`
9. `20261012174605_brand_workspace_onboarding.sql`
10. `20261012175927_external_api_billing_ledger.sql`

The first three replace the previously **unapplied** files numbered `20261012220000`, `20261012233000` and `20261012234000`. Their SQL wrappers were corrected and their timestamps moved before dependent work. If any environment has already applied those original versions, stop and reconcile that environment with a forward migration; do not mark migrations applied or drop tables to conceal a mismatch.

Historical September audit migrations have a filename ordering inconsistency. Do not blindly reset a production database from all filenames. Preserve applied historical versions and inspect the CLI dry run before pushing only these pending changes. Use the Supabase CLI's migration ledger/dry-run workflow with the approved deployment credentials.

After migration, regenerate database types from the target project's actual public schema and compare them with `src/types/database.types.ts`. Current added types were checked against the locally applied SQL catalog.

## Server environment and infrastructure

Configure Vercel Preview and Production separately. Never use `NEXT_PUBLIC_` for any secret. Existing values reported by the user were not re-read from Vercel; the current session had no active Vercel or Cloudflare connector, so configuration presence is unverified.

| Setting | Required behavior |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Existing target project and public client key. |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only trusted writes for reservations, provider observations and telemetry. Required even for campaign creation telemetry. |
| `NEXT_PUBLIC_SITE_URL` | Exact environment origin for sign-up callback; also allow its `/brand/auth/callback` in Supabase Auth redirects. |
| `SERP_API_KEY`, `SERP_API_ENABLED` | SerpApi key; enable only after dry-run/schema verification. Key name intentionally follows the existing deployment. |
| `SERP_API_COST_PER_SEARCH_USD` | Account-specific per-search estimate, or leave empty and show unreported. A configured USD budget requires an estimate. |
| `OPENAI_API_KEY`, `OPENAI_API_ENABLED`, `OPENAI_BRIEF_MODEL` | Server key and selected structured-output model; default model is `gpt-4.1-mini`. Set enabled to false to pause. |
| `OPENAI_INPUT_COST_PER_1M_USD`, `OPENAI_OUTPUT_COST_PER_1M_USD` | Actual current rates for the selected model, used only for estimates. |
| `HIGGSFIELD_API_KEY` | Combined `key_id:key_secret`; alternatively set `HIGGSFIELD_API_KEY_ID` and `HIGGSFIELD_API_KEY_SECRET`. A lone key without its secret is insufficient. |
| `HIGGSFIELD_API_ENABLED`, `HIGGSFIELD_MAX_PREVIEW_USD` | Explicit enable flag and positive per-preview USD ceiling no greater than100. Quotes come from Higgsfield. |
| `HIGGSFIELD_MEDIA_ALLOWED_HOSTS` | Comma-separated exact provider output hostnames verified from the account's real response/documentation. No wildcard or arbitrary user URL. |
| Existing `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional endpoint/public base URL | Preserve existing logo storage and Storyloop brand configuration. Public Storyloop logo remains served through the narrow public asset view. |
| `R2_PRIVATE_BUCKET_NAME` | A separate bucket with public access disabled, no public custom domain, and scoped object permissions for reference photos and generated previews. |

Configure Supabase email confirmation for brand sign-up. The email-code login path requires the email template to include the token; test actual delivery and both sign-in methods. Workspace creation requires a confirmed email and never grants membership merely from a matching email domain. Preserve the existing Creator authentication settings; this release does not activate a new SMS provider.

Set Vercel function duration support for the competitor page (180 seconds) and Create page (300 seconds), or choose hosting limits that support them. Provider requests have shorter internal deadlines; media generation itself remains asynchronous and status refresh is user initiated.

Use an approved private-asset retention policy before launch. Consent expires in seven days; serving routes enforce expiry/revocation immediately. Physical deletion of expired assets is not yet a scheduled application task. For an initial bounded storage policy, configure a bucket lifecycle for `private/creator-previews/` and `private/brand-previews/` with a retention period that covers the approved seven-day access window, and verify the policy in Cloudflare. Provider-side retention is managed separately by the provider contract. Do not claim revocation deletes third-party copies.

## Operating the workspace

- Curate `brand_creator_catalog` using real `creators.id` values. Publish only consented public details, with `active=true`, `directory_consented_at` and `published_at`. Add rates in `brand_creator_rates` in INR minor units (₹1 =100). Existing private creator contacts are not copied to Discover. No catalog seeds are included.
- Brand users approve saved brief fields, select available creator deliverables, inspect the exact Storyloop total, then generate/edit/approve concepts. Revisions invalidate dependent approvals. Selected rates are immutable snapshots until a new selection is saved.
- A creator signs in to `/creator/brand-requests` to review the exact request and upload an approved reference. An identity match or selection alone is not consent.
- `/brand/campaigns/<id>/manage` records the actual launch/completion. It does not publish to social platforms. Launch requires a current approved brief and creative; launched/completed campaigns cannot be edited as drafts.
- `/admin/settings/campaign-metrics` accepts real **daily increments**, one campaign/platform/post/UTC date. Re-entering the same tuple corrects its values. Leave unknown fields blank; enter zero only for measured zero. Money is INR, converted to minor units. Do not enter lifetime cumulative totals as daily rows.
- `/admin/settings/api-health` shows the bounded request window and policy state. Reconcile request charges or enter distinct invoices with verified evidence. Native USD invoices only; do not invent currency conversion or double count invoice and request totals.

Application caps and circuit behavior are specified in `brand-hub-api-controls.md`. Update `api_provider_policies` only through trusted operator access. A missing price with a configured spend ceiling intentionally blocks new paid work. Set all three policies disabled to stop new provider work immediately; status checks may also pause, so keep pending jobs visible for later reconciliation.

## Release verification and recovery

Deploy a review environment after applying its matching schema. Verify a fresh brand can confirm email, create a workspace, upload a logo, save a campaign, and resume it. Use a second brand to confirm tenant isolation. Then perform one bounded competition scan, cite/approve its brief, generate scripts, obtain one preview quote and explicitly approve one live render within the chosen cost ceiling. Confirm Admin request/timing/estimate entries and reconcile against provider records. Test creator consent/revocation with the actual creator authentication configuration. Record one sourced post-launch measurement and confirm its report ratios.

Before production, verify secrets, auth redirect/template settings, private bucket policy, media host allowlist, provider prices, function durations and migration dry run. These are activation gates, not claims that the user-provided keys are absent. Production application and schema release requires approval; no deployment or main-branch merge was performed during development.

To pause after release, disable provider environment flags and database policies, preserve existing campaign/evidence/billing rows, and reconcile jobs whose submission state is unknown before retrying. Use forward fixes for database problems. Do not drop the new tables to roll back a UI deployment. Keep the last compatible application version available and treat additive schema/state changes separately from app rollback.

## Running checks locally

Use Node22.6 or later (verification used Node24), then `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` with nonproduction Supabase configuration. For browser checks install Chromium with `npx playwright install chromium`, build, then `npm run test:browser`. `CHROMIUM_EXECUTABLE_PATH` can select a compatible installed Chromium. The runner starts its own local fixture API and Next server on ports4545/3001 and makes no real provider calls. Browser screenshots go to the ignored `tests/browser/artifacts/` directory.
