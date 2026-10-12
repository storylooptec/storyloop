-- Editable campaign plan storage and an atomic OpenAI generation quota.
alter table public.brand_campaigns
  add column requested_budget_cents integer
    check (requested_budget_cents is null or requested_budget_cents >= 0);

create table public.brand_campaign_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.brand_campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  brief jsonb not null default '{}'::jsonb,
  approval_state text not null default 'draft'
    check (approval_state in ('draft', 'approved')),
  generated_model text,
  generated_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_campaign_plans_company_updated_idx
  on public.brand_campaign_plans(company_id, updated_at desc);

alter table public.brand_campaign_plans enable row level security;
grant select, insert, update on public.brand_campaign_plans to authenticated;

create policy "brand members read their campaign plans"
on public.brand_campaign_plans for select to authenticated
using (app_private.is_brand_member(company_id));

create policy "brand members create their campaign plans"
on public.brand_campaign_plans for insert to authenticated
with check (
  app_private.is_brand_member(company_id)
  and exists (
    select 1 from public.brand_campaigns c
    where c.id = brand_campaign_plans.campaign_id
      and c.company_id = brand_campaign_plans.company_id
  )
);

create policy "brand members update their campaign plans"
on public.brand_campaign_plans for update to authenticated
using (app_private.is_brand_member(company_id))
with check (
  app_private.is_brand_member(company_id)
  and exists (
    select 1 from public.brand_campaigns c
    where c.id = brand_campaign_plans.campaign_id
      and c.company_id = brand_campaign_plans.company_id
  )
);

create table public.api_rate_limit_hour_windows (
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_key text not null,
  window_start timestamptz not null,
  calls_used integer not null default 0 check (calls_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, provider_key, window_start)
);

alter table public.api_rate_limit_hour_windows enable row level security;

create or replace function app_private.consume_openai_brief_quota(
  target_company_id uuid,
  target_campaign_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  quota_window timestamptz := date_trunc('hour', now());
  used_count integer;
begin
  if not app_private.is_brand_member(target_company_id) then
    return false;
  end if;

  if not exists (
    select 1 from public.brand_campaigns c
    where c.id = target_campaign_id and c.company_id = target_company_id
  ) then
    return false;
  end if;

  insert into public.api_rate_limit_hour_windows (
    campaign_id, company_id, provider_key, window_start, calls_used
  ) values (
    target_campaign_id, target_company_id, 'openai', quota_window, 0
  ) on conflict (campaign_id, provider_key, window_start) do nothing;

  select calls_used into used_count
  from public.api_rate_limit_hour_windows
  where campaign_id = target_campaign_id
    and provider_key = 'openai'
    and window_start = quota_window
  for update;

  if used_count >= 5 then return false; end if;

  update public.api_rate_limit_hour_windows
  set calls_used = calls_used + 1, updated_at = now()
  where campaign_id = target_campaign_id
    and provider_key = 'openai'
    and window_start = quota_window;

  return true;
end;
$$;

revoke all on function app_private.consume_openai_brief_quota(uuid, uuid) from public, anon;
grant execute on function app_private.consume_openai_brief_quota(uuid, uuid) to authenticated;

create or replace function public.consume_openai_brief_quota(
  target_company_id uuid,
  target_campaign_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private
as $
  select app_private.consume_openai_brief_quota(target_company_id, target_campaign_id);
$;

revoke all on function public.consume_openai_brief_quota(uuid, uuid) from public, anon;
grant execute on function public.consume_openai_brief_quota(uuid, uuid) to authenticated;
