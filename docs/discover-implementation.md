# Discover implementation and database review

Status: implementation verified and approved for deployment to main. Database setup remains a separate, manual step. No SQL was executed against Supabase and no production records were imported or modified.

## Inspection findings

The old `src/app/admin/(protected)/discover/page.tsx` was a static mock: creator results, 118/74/22 counts, 91/86 scores, ₹142 cost, source claims and run history were hardcoded. “Run discovery” had no provider call. Those results are removed from Discover. External discovery now explicitly says “Not connected”.

Related code inspected: `src/app/admin/(protected)/creators/page.tsx`, `src/app/admin/(protected)/creators/[creatorId]/page.tsx`, creator onboarding code, `src/auth/admin-context.ts`, `src/types/database.types.ts`, and the company, team-permissions, creator-hub and brand-catalog migrations. Existing admin authentication, authorization, shell, navigation, unrelated creator pages, campaigns and outreach are unchanged.

Supabase project `bgmjjqaxjusrvkiwykma` was inspected using read-only project/table metadata. Live creator rows could not be independently inspected: no authorized admin session or non-SQL row-read capability was available. Table metadata reporting zero rows is not treated as a verified record count. The spreadsheet was not assumed to exist in the database.

| Existing table | Relevant columns / constraints |
| --- | --- |
| creators | id, display_name, primary_handle, metadata (JSONB), created_at, updated_at |
| company_creators | id, company_id, creator_id, status, source, commercial_relationship, metadata (JSONB), created_at, updated_at; unique company_id + creator_id |
| creator_social_accounts | id, creator_id, profile_url, platform, handle, is_primary, verification_status, metadata (JSONB), created_at, updated_at; unique creator_id + profile_url |
| creator_accounts | user_id, creator_id, company_id, phone, tier, onboarding_data (JSONB), onboarding fields and timestamps |
| brand_creator_catalog | Consent/publishing-oriented catalog; intentionally not used or changed by this import |

There are no standardized spreadsheet metrics/demographics/content-value columns. Existing onboarding JSON contains category/city/askedRates; askedRates is not assumed equivalent to the spreadsheet values. Existing social read policies depend on Auth-linked creator accounts, while imported contacts should not receive Auth accounts. Authenticated operators cannot directly insert creator identity records.

## Proposed SQL — user review and execution required

Exact script: `supabase/setup/discover-import.sql`. Paste the complete transaction into the Supabase SQL Editor only after review.

No table or column redesign is necessary. The script reuses `company_creators.metadata.discover` for normalized fields, original headers/cells, SR NO, worksheet row, filename/sheet, importer/time and metric provenance. It adds:

- A partial unique company + imported Instagram identity index. Legacy records without this metadata are untouched; existing conflicting import identities abort the transaction, without merging/deleting records.
- A SELECT policy allowing company members to read social profiles linked through company_creators.
- Permission-checked atomic import functions and a readiness function, with authenticated-only grants and company-specific serialization for duplicate import requests.

The script is rerunnable and changes no existing creator rows. Each new row inserts a creator identity, company relationship and social profiles atomically. It creates no creator Auth account, campaign or brand catalog entry. Existing matching records return a duplicate outcome without update. Duplicate checks are company-scoped and include legacy primary handles and social profiles.

**SQL-dependent code:** `importCreatorRows` and the import-save button require `discover_import_ready` / `import_discover_creator`. Imported social reads need the added policy. RPC types in `database.types.ts` describe this proposed SQL. Existing database browsing and file mapping/preview use existing tables and remain available before SQL; failures are shown explicitly. Saving stays disabled if the readiness function is absent or permission is missing.

## Implemented behavior

- Company-scoped database table: name/handle search; category, platform, location and completeness filters; followers, average views, ER, Reel Post and update-time sorting; missing values sort last in either direction.
- Compact table with the requested columns and 50-row pages. Creator detail dialog includes every supplied field, contact/demographic data, other social profiles, original cells and available raw onboarding/profile metadata.
- Missing values are em dashes, not zeros. Empty database, unmatched filters, load failures and subset limits are distinct states. Record update time, import time and metric observation time are separate; unknown metric dates remain unknown.
- XLSX/CSV worksheet selection, editable column mapping, original-cell preview, server-side validation, per-row errors and selectable valid rows. In-file duplicate identities are all held for review. Existing duplicates are never overwritten. Every row receives an import/duplicate/invalid/empty/not-selected/failed/not-confirmed summary outcome.
- Retry rechecks the database; interrupted batches report unconfirmed rows. No silent truncation or discard. Source values remain in the original row even when normalized fields differ.
- Separate external workflow explicitly disconnected, without fabricated results, counts, scores, sources or costs.

Main new code is in `src/discover/{data,files,import,model}.ts`, `src/components/admin/discover/`, and the Discover server actions. Styling is scoped to the new component module. Dependencies added: read-excel-file and csv-parse.

## Assumptions and limits

- NAME and a valid Instagram profile/handle are required for imports. Rows missing either remain visible with errors.
- Numeric ER is a fraction (0.0404 = 4.04%); explicit percentage strings are also supported. Ambiguous abbreviations such as 1.2M are rejected rather than guessed.
- Reel Post and other format values are nonnegative numeric source values. Their meaning and currency still require your confirmation; no currency symbol or rate assumption is applied.
- Demographics/contact/location are never invented. Imported metrics are explicitly unverified. Raw demographic text is retained rather than guessed into structured segments.
- A worksheet supports up to 500 data rows, 50 columns and 2 MB uploads; unsupported files and oversized sheets fail explicitly. Imports run in batches of 50, atomically per row.
- Database loading is capped at 10,000 company creators with a visible subset warning. Import is blocked above that limit so duplicate preview cannot silently miss records. Social reads are paginated and fail explicitly if their safety limit is exceeded.
- This is a browse/detail/import workflow, not a new inline creator-editing or merging system.

## Verification

- Lint, TypeScript and production build checks all passed.
- 14 focused tests: normalization, mapping, numeric/percentage validation, raw preservation, duplicates, filters/sorting, missing values, CSV parsing, XLSX parsing, oversize failures; local PostgreSQL-compatible tests cover unauthorized/cross-company imports, duplicate preservation, social read policy and atomic rollback. The SQL was applied twice only to an isolated PGlite test database.
- The supplied workbook's 20 creator rows validate successfully; none were imported into Supabase.
- Browser checks passed for auth redirects, search/category filtering, sorting, details, mobile layout, empty/missing/error states, disconnected provider, editable mapping, CSV validation/import summary, retry duplicate protection, missing SQL, and preview of all 20 supplied XLSX rows. These use an isolated HTTP Supabase fixture and never connect to production or send outreach.

Reproduce core checks:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
node --test tests/discover.test.mjs tests/discover-database.test.mjs
node tests/browser/discover.mjs
```

The optional `DISCOVER_SAMPLE_PATH` environment variable enables the supplied-workbook test. The browser test needs Playwright Chromium, or `CHROMIUM_EXECUTABLE_PATH` pointing to an installed Chromium binary.
