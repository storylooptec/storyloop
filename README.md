# Storyloop

Storyloop platform foundation.

## Current build status

- Step 1: repository audit — complete
- Step 2: shared design-token system — implemented
- Step 3: authenticated `/admin` shell — implemented on its development branch
- Step 4: Company schema + Storyloop seed — implemented on its development branch
- Step 5: Team / roles / permissions foundation — implemented on its development branch
- Step 6: Brand & Appearance settings — implemented on its development branch
- Step 7: Cloudflare R2 upload service + logo upload — implemented on its development branch
- Step 8: Configuration / Feature Flags — implemented on its development branch
- Step 9: Integrations registry + provider mock foundation — implemented on its development branch
- Step 10: Templates foundation — implemented on its development branch
- Step 11: Audit log foundation — implemented on its development branch

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and publishable key.
4. Run `npm run dev`.

The admin area uses Supabase Auth and does not include a service-role key in browser code.
