# Storyloop

Storyloop platform foundation.

## Current build status

- Step 1: repository audit — complete
- Step 2: shared design-token system — implemented
- Step 3: authenticated `/admin` shell — implemented on its development branch
- Step 4: Company schema + Storyloop seed — implemented on its development branch
- Step 5: Team / roles / permissions foundation — implemented on its development branch
- Step 6: Brand & Appearance settings — implemented on its development branch
- Step 7: Supabase Storage for logos, creator reference photos and generated previews
- Step 8: Configuration / Feature Flags — implemented on its development branch
- Step 9: Integrations registry + provider mock foundation — implemented on its development branch
- Step 10: Templates foundation — implemented on its development branch
- Step 11: Audit log foundation — implemented on its development branch
- Step 12: Agency operations shell and six operational screens — implemented on its development branch
- Step 12: Agency operational navigation/screens — implemented on its development branch

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and publishable key.
4. Run `npm run dev`.

The admin area uses Supabase Auth and does not include a service-role key in browser code.

- Admin context-help system — implemented on its development branch

## File storage

All app-managed file uploads use Supabase Storage. Apply the `supabase_asset_storage`
migration before publishing the app. It creates two private buckets:
`storyloop-brand-assets` (5 MB logos/icons) and `storyloop-private-media` (creator
references and generated previews, up to 50 MB; the project global limit also applies).
Existing `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` (or legacy
`SUPABASE_SERVICE_ROLE_KEY`) are sufficient. R2 environment variables are unused.

Direct anonymous/authenticated bucket access is denied. Trusted server helpers run
only after the existing admin, tenant or creator-consent checks. Only the platform
logos selected by the existing public view are served publicly through the app;
campaign logos and generated media remain private. Creator reference links expire
after one hour; generated media is streamed through a consent-checked route, with
video range requests supported. Private URLs are never persisted as public metadata.

Cutover does not copy or delete old R2 objects. At inspection there were no campaign
logos, reference photos or completed preview files to copy. The legacy platform
logo (`storyloop_logo_transparent.webp`) must be re-uploaded through Admin → Brand &
Appearance. Existing key references remain untouched until replacement. Rollback
is the previous app commit; preserve Supabase objects and backfill any new file
keys before changing storage providers again.
