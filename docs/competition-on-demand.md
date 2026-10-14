# Competition research: discovery, then Get

New scans use flow `on_demand_v2`. Historical reports remain readable.

1. Scan competition queues one OpenAI Responses request with native `web_search`, capped at three built-in tool calls. SearchAPI is not used, including for identity verification. The prompt establishes the target business, offering and location, and researches up to five relevant competitors.
2. Every accepted official website must occur in actual tool sources or citations. The target brand, source-only sites, duplicate domains and invented domains are rejected. Fewer than five is allowed; zero is a failed discovery, never a successful empty report.
3. Names, websites, relevance and available social links appear in cards. Bounded public HTML reads may add links from official websites without search credits. This is best-effort and does not require browser automation or a new service.
4. Each card starts with Not fetched criteria. Only its Get button authorizes detail tasks through a service-only, tenant-checked database transaction. Repeated Get requests join existing work, including after failures.
5. The existing task runner processes at most two paid calls concurrently. First-page SearchAPI responses are cached per workspace for 24 hours. No automatic paid retries, pagination, per-ad detail fan-out or rank tracking are included.

| Request | Engine | When |
|---|---|---|
| Products/services/published prices | google | Once per requested competitor |
| LinkedIn ads | linkedin_ad_library | Once per requested competitor |
| Reddit ads | reddit_ad_library | Once per requested competitor |
| Facebook page discovery | meta_ad_library_page_search | Only if no official Facebook link exists |
| Facebook profile | facebook_business_page | One identified page, at most once |
| Facebook reviews | facebook_business_page_reviews | Only after the page identity is verified |
| Meta ads | meta_ad_library | Only after the page identity is verified; reuse page ID |

Maximum seven SearchAPI attempts per competitor, including failed or uncertain attempts, enforced atomically in PostgreSQL. Known Facebook links normally reduce the maximum to six; missing or ambiguous identity skips dependent calls. The per-scan cap is 35 only when all five cards are explicitly requested. Existing platform daily/monthly limits and the three-fresh-scans-per-workspace limit remain enforced. OpenAI discovery costs are separate; Get has no additional AI summary call.

Facebook sentiment is a count of recommendation labels among retrieved reviews with actual review text. It is not market-wide sentiment. Reddit ad-library results are advertising evidence, not community sentiment. LinkedIn library matches are explicitly labelled as advertiser-name matches because the supplied listing endpoint does not independently prove advertiser ownership. Missing spend, reach or campaign performance is never invented.

Saved detail evidence is summarized deterministically and published progressively. Expired or uncertain work is not automatically re-billed. A new scan after the 24-hour cache expires is required for fresh research.

Validation uses local fixtures and isolated PostgreSQL; it makes no paid provider calls. The deployment requires `supabase/setup/competition-on-demand.sql`, applied through the migration tool and recorded in migration history. No new environment variables or workers are required.
