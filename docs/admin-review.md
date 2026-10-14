# Storyloop admin review

Reviewed main commit `860df5d1ba437b18ced8e941046e9729db0aefc9`, verified through the GitHub connector. Scope: admin routes, admin components and directly supporting code/styles. No app code, database records or deployment changed during this review.

## Evidence and limits

Read all admin page routes and relevant navigation, auth/permissions, help, data-loading and save-action code. Rendered 20 admin page/view variants locally with an isolated Supabase HTTP fixture (18 sidebar destinations plus Add and Pool). Inspected desktop screenshots and mobile Overview at 390px. Live `/admin` redirected to login; no production account/data was inspected. Local fixture counts are not production counts. Authenticated provider calls and production saves were not tested. The supplied Phase 1 document was read as historical product context, not permission to remove later product capabilities.

## Recommendation

Consolidate daily work into Home, Creators, Brands & enquiries, and Campaigns, with Settings at the bottom. Only expose operational capabilities as working actions when backed by real data and handlers. Keep unfinished functionality out of the daily workspace. Retain existing authentication, role checks and company isolation.

The admin currently mixes three purposes: an operations desk, an engineering control panel, and an illustrative future-product walkthrough. Users must determine which purpose each screen serves before doing a task.

## Priority findings

1. **Mobile navigation is absent.** `src/app/globals.css` sets `.admin-sidebar { display: none }` below 800px. The later 860px rules reveal its children but never restore the parent. Browser verification: sidebar false, Menu button false at 390px. Restore a visible header/menu and use one consistent breakpoint.
2. **Three entrances to creator work disagree.** `admin/creators` reads company relationships and account onboarding, Discover reads the same identities plus imported metadata, and `/admin/add` is a static mock. Consolidate one creator database/detail model. Make Import an explicit action there; reserve Find new creators for external discovery.
3. **Imported contacts can appear under “Roster” without consent semantics.** Creators fetches all company_creators without a consent/status filter; help describes Roster as consented. Imports create discovered relationships, not consented listings. This is an admin presentation/classification problem; it does not establish any public catalog exposure. Distinguish all contacts, imported/discovered, onboarding and eligible/consented records using verified rules. Never infer consent from import.
4. **Prominent controls are inactive.** Add's source tabs and Add to Pool, Brands' Read & fix/Send invite, Campaigns' Review & send and Money's Review run have no action handlers. Global search is explicitly disabled yet occupies every page. Remove unfinished controls from normal workflows; point Add to the working import path immediately.
5. **Demo values remain in production admin.** Brands, Campaigns, Money and Creator Pool use hardcoded examples. They do include an illustrative disclaimer, but realistic amounts, status indicators and enabled buttons dominate visually. A small disclaimer is insufficient for an operational screen. Replace with honest unavailable/empty states or isolate a clearly separate demo.
6. **Overview/Today can hide data failures.** Overview uses `count ?? 0` and empty arrays without handling query errors; Today also falls back to empty arrays. Creators ignores read errors. Failed reads can look like no creators/no alerts/no failures. Distinguish unavailable from measured zero and offer retry.
7. **Creator labels and counts are misleading.** Overview labels every company relationship “Completed”/“Listed”; that now includes imported contacts. Older Creator list/detail reads rates/category/contact from account onboarding, not Discover metadata. Imported records consequently show missing fields or `Step —/9`. Also a zero reel rate is displayed as missing through a truthiness check. Reuse a common normalized record adapter and show Not applicable for account-only fields.
8. **Integration status has two meanings.** Integrations lets an operator manually choose Live/Error; API Health describes actual observed request results and credential/policy readiness. Overview counts the manually stored state. Separate requested operating mode from observed connection health and consolidate the screens under Settings → Connections & usage.
9. **Onboarding/help is stale.** Welcome describes Discover outreach, consented roster, brand enquiries and financial actions that the relevant admin pages do not implement. Help starts a generic tour, including a disabled search. Replace with contextual task help that matches available functionality.
10. **18 sidebar links give technical settings equal prominence to daily tasks.** Eleven are platform links. All are shown regardless of role, even when junior access is read-only. Move these under grouped Settings; keep relevant read access but reduce routine distraction.
11. **Campaign work is split incorrectly.** The Campaigns page is an illustrative six-state board; real measurement entry is under Settings → Campaign Metrics. The board adds a second five-step launch sequence. Put actual records and measurements together under Campaigns, using one primary state model. This recommendation is scoped to admin presentation, not a change to the brand-facing workflow.
12. **Essential desk tasks are less discoverable than technical tools.** There is no dedicated operational brand enquiry list in admin. The Phase 1 brief explicitly calls for a filterable/exportable creator list and enquiry list. Creator table export is also absent. Confirm the current enquiry data source before connecting it; do not invent another table or fabricate records.

## Page-by-page disposition

| Current area | Current implementation | Recommended disposition |
| --- | --- | --- |
| Overview | Database counts, repeated creator summaries, system health, audit snippets; weak error handling | Merge with Today as Home; actionable work first, a few clearly defined totals |
| Today | Real onboarding/consent alert queries, plus illustrative agency section | Home work queue; remove empty demo section; define “paused” rather than label all incomplete accounts paused |
| Creators | Database roster and illustrative Pool; older account-centric details | One canonical creator database; explicit lifecycle/consent filters; common details |
| Discover | Database search/filter/sort/details and import; external provider disconnected | Reuse its working table/import inside Creators; external discovery remains a separate subview |
| + Add | Inactive intake mock | Replace with Import creators; add manual entry only when implemented |
| Brands | Hardcoded brand-room example and inert actions | Real brand/enquiry list when connected; clear unavailable state until then |
| Campaigns | Illustrative board, second launch sequence, inert send action | Real admin campaign list/detail; measurements within campaign context |
| Money | Hardcoded currency amounts and payout examples | Remove demo financial figures; keep outside daily navigation until real ledger is connected |
| Company | Read-only real company identity | Settings → Organisation; plain language |
| Team & Roles | Membership list, mostly UUIDs and generic member names; no management controls | Settings → Team; show identities when safely available; distinguish viewing from managing |
| Experiences | Hardcoded product inventory/build-status labels | Settings → Product links or remove; current build claims can become stale |
| Creator Experience | Real editable CMS; title says Creator CMS | Settings → Content → Creator content; consistent label; technical keys in advanced detail |
| Brand & Appearance | Persisted logos, themes, typography, spacing/radii controls | Settings → Appearance; simple logo/theme controls first, design tokens advanced |
| Integrations | Persisted manually selected operating state | Settings → Connections & usage; distinguish mode from verified health |
| API Health & Spend | Usage history, observed status, costs, billing/reconciliation and detailed operating rules | Same settings group; Summary/Usage/Billing/Advanced rather than one long technical screen |
| Campaign Metrics | Real manual measurement entry/query code | Move into Campaigns → selected campaign → Performance |
| Configuration | Database-backed rules and feature switches | Settings → Advanced; readable labels, clear dependencies and save results |
| Templates | Database-backed message/document templates | Settings → Templates; show where each is used, preview before save |
| Audit & Logs | Latest 100 events, raw actions and entity IDs | Settings → Activity log; readable actions, filtering and pagination |

## Recommended navigation and flows

- **Home:** what needs attention, next action, small set of real totals.
- **Creators:** one database; source/lifecycle filters; Metrics, Content values and All fields column views; Import action; full shared detail; export. Keep source timestamps and unknown-value semantics. Do not label unconfirmed spreadsheet values as INR rates.
- **Brands & enquiries:** actual requests and brand records, owner and next action. Until wired, avoid showing demo brand intelligence as work.
- **Campaigns:** actual campaign records with briefs, selected creators and performance in their context. Preserve current backend state rules.
- **Settings:** Organisation & team; Content & appearance; Connections & usage; Templates; Advanced rules; Activity log.

Until Brands/enquiries and admin Campaigns are connected, the daily navigation can be Home, Creators and Settings. Do not expose more empty pages merely to match a sitemap. Finance can return when a real ledger supports it.

Creator import flow: Creators → Import → select file → confirm mappings → review rows/errors → import selected valid rows → summary → View imported creators. Display an administrator-readable setup action when SQL is missing. Do not ask an everyday operator to diagnose database functions.

## Visual and language changes

Keep the existing Storyloop brand; no new theme is needed. Improve low-contrast secondary text, use readable sentence-case labels, reduce repeated explanations and large empty KPI areas, and give each screen one clear primary task. Hide technical IDs, provider rules, raw metadata and design tokens behind expandable advanced sections. Examples of unnecessary terminology include Ingest, Supply, Single state machine, Managed overlay and Live foundation. Keep precise terms where operators genuinely need them.

At mobile size the full Overview becomes a long stack of largely repeated counts, while navigation disappears. Fix navigation first; follow with compact summaries and task-first content. Table scrolling can remain for dense data, with identity columns kept visible where practical.

## Safe implementation order

1. One admin-only cleanup patch: mobile menu, working Add/import entry, remove demo operational figures/actions, remove disabled global search, correct help text and error states.
2. Consolidate Creator list/details/import and correct contact-versus-consented classifications; preserve all stored data and existing consent checks.
3. Merge Home/Today and group Settings; update routes with redirects so bookmarks survive.
4. Connect real brand/enquiry and campaign admin views after verifying their existing data/permission models. Add export. Keep financial screens hidden/unavailable until their real data exists.

Verify desktop/mobile navigation, both roles, empty/error states, import round trip, shared creator fields, and unchanged permissions. No broad redesign or database migration is justified simply to simplify the menu. Any later required SQL should still be supplied for manual review/execution under the user's existing instruction.
