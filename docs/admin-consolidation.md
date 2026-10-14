# Admin consolidation

Implemented and verified after approval of the five-destination recommendation; approved for deployment to main. No database changes required.

## Changes

- Main navigation: Home, Creators, Brands & enquiries, Campaigns, Settings.
- Discover remains at `/admin/discover`, with a permanent child link under Creators. Creators and Add redirect to it, eliminating the conflicting older list and inactive intake form. Existing creator detail URLs still work for onboarding alerts.
- No files in the Discover routes, components, shared data/import code or SQL were edited. Its tabs, fields, filters, preview, validation and save behavior are unchanged.
- Home replaces Overview and Today; old paths redirect. It shows clearly defined company record/account totals, incomplete onboarding and company-scoped revoked studio-consent alerts. Read failures show unavailable states rather than zero.
- Settings groups all existing administrative tools. Campaign measurements remain at their existing URL and are now reached from Campaigns, with a back link to Campaigns.
- Removed disabled global search and the inactive global Add control. Context navigation and updated Help reflect the available tools.
- Brands and campaign management show honest disconnected states. Existing campaign measurement entry remains accessible. Money's old URL shows an unavailable state without hardcoded financial figures.
- Product links replace the stale hardcoded build-status inventory.
- Mobile sidebar/Menu display is restored using admin-only component styling. No shared global stylesheet or public-product files changed.

## Verification

- Lint, TypeScript/production build passed.
- New isolated Playwright test passed: five destinations, old URL redirects, all 10 grouped settings links, campaign measurements, absence of sample brand/money content, Home error state, mobile navigation at 390/800/860px, junior read-only settings, reopening Help, and unauthenticated redirect.
- Existing Discover browser regression passed, including search/filter/sort/details, CSV mapping/validation/import summary, normalized duplicates/retries, missing SQL, empty/error states and the supplied 20-row XLSX preview. Imports in this test use only the local fixture, not Supabase.
- Desktop Home and mobile Discover screenshots visually reviewed.
- Git diff confirms Discover files and auth/permission files are unchanged.

No database changes or new dependencies. The existing manual Discover SQL prerequisite remains unchanged. Brand/enquiry administration and the campaign-management board are not newly connected by this navigation patch; their pages explicitly say so. The brand-facing and creator-facing products are untouched.
