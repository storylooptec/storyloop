-- Brand-side Phase 1 data foundation. Apply only after review; all tables are tenant-scoped and RLS protected.

create table public.brand_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index brand_memberships_user_status_idx
  on public.brand_memberships(user_id, status);

create table public.brand_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  brand_name text not null,
  website_url text,
  logo_key text,
  promoted_item text not null,
  objective text not null check (objective in ('awareness', 'consideration', 'sales')),
  deliverables text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'scanning', 'planning', 'ready_for_desk', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_campaigns_company_updated_idx
  on public.brand_campaigns(company_id, updated_at desc);

create table public.brand_competitor_scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  provider_key text not null default 'serpapi',
  query_hash text not null,
  market text not null default 'IN',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  result_count integer not null default 0 check (result_count >= 0),
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index brand_competitor_scans_campaign_created_idx
  on public.brand_competitor_scans(campaign_id, created_at desc);

create unique index brand_competitor_one_active_scan_per_campaign_idx
  on public.brand_competitor_scans(campaign_id)
  where status in ('queued', 'running');

create table public.brand_competitor_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scan_id uuid not null references public.brand_competitor_scans(id) on delete cascade,
  competitor_name text not null,
  competitor_domain text,
  source_url text not null,
  source_domain text not null,
  source_title text not null,
  source_snippet text not null check (char_length(source_snippet) <= 600),
  published_at timestamptz,
  observed_at timestamptz not null default now(),
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (scan_id, source_url)
);

create index brand_competitor_observations_company_date_idx
  on public.brand_competitor_observations(company_id, observed_at desc);

create table public.external_api_usage_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  campaign_id uuid references public.brand_campaigns(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  provider_key text not null,
  operation text not null,
  model text,
  status text not null check (status in ('success', 'failed', 'rate_limited', 'cached')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  retry_count integer not null default 0 check (retry_count between 0 and 2),
  cache_hit boolean not null default false,
  input_units integer,
  output_units integer,
  unit_type text,
  estimated_cost_usd numeric(12,6),
  billed_cost_usd numeric(12,6),
  billed_cost_verified boolean not null default false,
  failure_code text,
  created_at timestamptz not null default now(),
  check (billed_cost_verified = false or billed_cost_usd is not null)
);

create index external_api_usage_events_provider_created_idx
  on public.external_api_usage_events(provider_key, created_at desc);
create index external_api_usage_events_company_created_idx
  on public.external_api_usage_events(company_id, created_at desc);
create index external_api_usage_events_campaign_created_idx
  on public.external_api_usage_events(campaign_id, created_at desc);

create table public.api_rate_limit_windows (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_key text not null,
  window_start date not null,
  calls_used integer not null default 0 check (calls_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (company_id, provider_key, window_start)
);

alter table public.api_rate_limit_windows enable row level security;

create or replace function app_private.is_brand_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.brand_memberships bm
      where bm.company_id = target_company_id
        and bm.user_id = (select auth.uid())
        and bm.status = 'active'
    );
$$;

create or replace function app_private.is_storyloop_operator(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.team_memberships tm
      join public.role_permissions rp on rp.role = tm.role
      join public.companies c on c.id = tm.company_id
      where c.slug = 'storyloop'
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and rp.permission = required_permission
    );
$$;

create or replace function app_private.consume_serpapi_scan_quota(target_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  quota_window date := (now() at time zone 'UTC')::date;
  used_count integer;
begin
  if not app_private.is_brand_member(target_company_id) then
    return false;
  end if;

  insert into public.api_rate_limit_windows (company_id, provider_key, window_start, calls_used)
  values (target_company_id, 'serpapi', quota_window, 0)
  on conflict (company_id, provider_key, window_start) do nothing;

  select calls_used into used_count
  from public.api_rate_limit_windows
  where company_id = target_company_id
    and provider_key = 'serpapi'
    and window_start = quota_window
  for update;

  if used_count >= 3 then return false; end if;

  update public.api_rate_limit_windows
  set calls_used = calls_used + 1, updated_at = now()
  where company_id = target_company_id
    and provider_key = 'serpapi'
    and window_start = quota_window;

  return true;
end;
$$;

revoke all on function app_private.is_brand_member(uuid) from public, anon;
revoke all on function app_private.consume_serpapi_scan_quota(uuid) from public, anon;
revoke all on function app_private.is_storyloop_operator(text) from public, anon;
grant execute on function app_private.is_brand_member(uuid) to authenticated;
grant execute on function app_private.consume_serpapi_scan_quota(uuid) to authenticated;

create or replace function public.consume_serpapi_scan_quota(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private
as $$
  select app_private.consume_serpapi_scan_quota(target_company_id);
$$;

revoke all on function public.consume_serpapi_scan_quota(uuid) from public, anon;
grant execute on function public.consume_serpapi_scan_quota(uuid) to authenticated;
grant execute on function app_private.is_storyloop_operator(text) to authenticated;

alter table public.brand_memberships enable row level security;
alter table public.brand_campaigns enable row level security;
alter table public.brand_competitor_scans enable row level security;
alter table public.brand_competitor_observations enable row level security;
alter table public.external_api_usage_events enable row level security;

grant select on public.brand_memberships to authenticated;
grant insert, update on public.brand_memberships to authenticated;
grant select, insert, update on public.brand_campaigns to authenticated;
grant select, insert, update on public.brand_competitor_scans to authenticated;
grant select, insert on public.brand_competitor_observations to authenticated;
grant select, insert on public.external_api_usage_events to authenticated;

create policy "brand users read their own membership"
on public.brand_memberships for select to authenticated
using (user_id = (select auth.uid()) or app_private.is_storyloop_operator('operations.work'));

create policy "Storyloop approvers manage brand memberships"
on public.brand_memberships for all to authenticated
using (app_private.is_storyloop_operator('approvals.perform'))
with check (app_private.is_storyloop_operator('approvals.perform'));

create policy "brand members read their company"
on public.companies for select to authenticated
using (app_private.is_brand_member(id));

create policy "brand members read their campaigns"
on public.brand_campaigns for select to authenticated
using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));

create policy "brand members create their campaigns"
on public.brand_campaigns for insert to authenticated
with check (created_by = (select auth.uid()) and app_private.is_brand_member(company_id));

create policy "brand members update their campaigns"
on public.brand_campaigns for update to authenticated
using (app_private.is_brand_member(company_id))
with check (app_private.is_brand_member(company_id));

create policy "brand members read their competitor scans"
on public.brand_competitor_scans for select to authenticated
using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));

create policy "brand members create their competitor scans"
on public.brand_competitor_scans for insert to authenticated
with check (
  created_by = (select auth.uid())
  and app_private.is_brand_member(company_id)
  and exists (
    select 1
    from public.brand_campaigns c
    where c.id = brand_competitor_scans.campaign_id
      and c.company_id = brand_competitor_scans.company_id
  )
);

create policy "brand members update their competitor scans"
on public.brand_competitor_scans for update to authenticated
using (app_private.is_brand_member(company_id))
with check (app_private.is_brand_member(company_id));

create policy "brand members read their competitor observations"
on public.brand_competitor_observations for select to authenticated
using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));

create policy "brand members store observations for their own scans"
on public.brand_competitor_observations for insert to authenticated
with check (
  app_private.is_brand_member(company_id)
  and exists (
    select 1
    from public.brand_competitor_scans s
    where s.id = brand_competitor_observations.scan_id
      and s.company_id = brand_competitor_observations.company_id
  )
);

create policy "brand and Storyloop users append API usage events"
on public.external_api_usage_events for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (
    (company_id is not null and app_private.is_brand_member(company_id))
    or app_private.is_storyloop_operator('operations.work')
  )
);

create policy "Storyloop operators read API usage events"
on public.external_api_usage_events for select to authenticated
using (app_private.is_storyloop_operator('operations.work'));

create or replace view public.storyloop_public_brand_assets
with (security_barrier = true)
as
select
  s.primary_logo_key,
  s.light_logo_key,
  s.dark_logo_key
from public.company_brand_settings s
join public.companies c on c.id = s.company_id
where c.slug = 'storyloop';

grant select on public.storyloop_public_brand_assets to anon, authenticated;
