-- Campaign metrics are daily deltas per post/platform/UTC date, never lifetime snapshots.
alter table public.brand_campaigns
  add column actual_live_at timestamptz,
  add column completed_at timestamptz,
  add constraint brand_campaign_completion_order check (completed_at is null or (actual_live_at is not null and completed_at >= actual_live_at));
-- Lifecycle writes use the checked RPC; generation/scan services remain subject to the trigger below.
revoke update on public.brand_campaigns from authenticated;
create policy "brand campaign creation starts at draft" on public.brand_campaigns as restrictive for insert to authenticated
with check (status = 'draft' and actual_live_at is null and completed_at is null);

create table public.brand_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  metric_date date not null,
  platform text not null check (platform in ('instagram','youtube','tiktok','facebook','linkedin','other')),
  external_post_id text not null check (char_length(external_post_id) between 1 and 240),
  source_type text not null check (source_type in ('manual_export','platform_api')),
  source_reference text not null check (char_length(source_reference) between 3 and 1000),
  views bigint check (views between 0 and 1000000000),
  impressions bigint check (impressions between 0 and 1000000000),
  engagements bigint check (engagements between 0 and 1000000000),
  clicks bigint check (clicks between 0 and 1000000000),
  conversions bigint check (conversions between 0 and 1000000000),
  spend_cents bigint check (spend_cents between 0 and 100000000000),
  revenue_cents bigint check (revenue_cents between 0 and 100000000000),
  currency text not null default 'INR' check (currency = 'INR'),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,platform,external_post_id,metric_date),
  check (num_nonnulls(views,impressions,engagements,clicks,conversions,spend_cents,revenue_cents) > 0)
);
create index brand_campaign_metrics_company_date_idx on public.brand_campaign_metrics(company_id,metric_date desc);
create index brand_campaign_metrics_campaign_date_idx on public.brand_campaign_metrics(campaign_id,metric_date desc);
alter table public.brand_campaign_metrics add constraint metrics_campaign_company_fk foreign key(campaign_id,company_id)
  references public.brand_campaigns(id,company_id) on delete cascade;
comment on table public.brand_campaign_metrics is 'UTC daily increments per source post. Upsert replaces same campaign/platform/post/day. Blank means unknown; zero means measured zero. Never insert cumulative snapshots.';
alter table public.brand_campaign_metrics enable row level security;
grant select,insert,update on public.brand_campaign_metrics to authenticated;
create policy "brand members and operators read campaign measurements" on public.brand_campaign_metrics for select to authenticated
using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));
create policy "operators insert campaign measurements" on public.brand_campaign_metrics for insert to authenticated
with check (app_private.is_storyloop_operator('operations.work') and recorded_by = (select auth.uid()));
create policy "operators correct campaign measurements" on public.brand_campaign_metrics for update to authenticated
using (app_private.is_storyloop_operator('operations.work'))
with check (app_private.is_storyloop_operator('operations.work') and recorded_by = (select auth.uid()));

create or replace function app_private.validate_campaign_measurement()
returns trigger language plpgsql security definer set search_path = pg_catalog,public,app_private as $$
declare campaign public.brand_campaigns;
begin
  select * into campaign from public.brand_campaigns where id = new.campaign_id;
  if campaign.id is null or campaign.company_id <> new.company_id or campaign.status not in ('active','completed') or campaign.actual_live_at is null then
    raise exception 'Measurement requires a launched campaign in the same company';
  end if;
  if new.metric_date < (campaign.actual_live_at at time zone 'UTC')::date or new.metric_date > (now() at time zone 'UTC')::date then
    raise exception 'Measurement date must be between campaign launch and today';
  end if;
  if TG_OP = 'UPDATE' and (old.campaign_id <> new.campaign_id or old.company_id <> new.company_id) then
    raise exception 'Measurement campaign cannot change';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function app_private.validate_campaign_measurement() from public,anon,authenticated;
create trigger validate_campaign_measurement before insert or update on public.brand_campaign_metrics
for each row execute function app_private.validate_campaign_measurement();

-- Enforce readiness in the database, including direct REST writes.
create or replace function app_private.guard_campaign_lifecycle()
returns trigger language plpgsql security definer set search_path = pg_catalog,public,app_private as $$
begin
  if TG_OP = 'INSERT' then
    if new.status in ('active','completed') or new.actual_live_at is not null or new.completed_at is not null then
      raise exception 'Create a draft and approve it before recording launch';
    end if;
    return new;
  end if;
  if new.id <> old.id or new.company_id <> old.company_id or new.created_by <> old.created_by then
    raise exception 'Campaign identity and tenant are immutable';
  end if;
  if old.status in ('active','completed','archived') and new.status not in ('active','completed','archived') then
    raise exception 'Launched campaign cannot return to draft';
  end if;
  if old.status in ('completed','archived') and new.status = 'active' then
    raise exception 'Completed or archived campaigns cannot relaunch';
  end if;
  if old.actual_live_at is not null and new.actual_live_at is distinct from old.actual_live_at then
    raise exception 'Recorded launch date is immutable';
  end if;
  if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
    raise exception 'Recorded completion date is immutable';
  end if;
  if new.status = 'active' and old.status <> 'active' then
    if old.status not in ('draft','planning','ready_for_desk') then
      raise exception 'Campaign is not ready for a launch transition';
    end if;
    if new.actual_live_at is null or new.actual_live_at > now() or new.completed_at is not null then
      raise exception 'Valid actual launch date required';
    end if;
    if not exists (
      select 1 from public.brand_campaign_plans p
      join public.brand_campaign_creatives cr on cr.campaign_id = p.campaign_id and cr.company_id = p.company_id
      where p.campaign_id = new.id and p.company_id = new.company_id and p.approval_state = 'approved'
        and cr.approval_state = 'approved' and cr.plan_revision = p.revision
    ) then raise exception 'Current approved brief and approved creative are required'; end if;
  elsif new.actual_live_at is distinct from old.actual_live_at then
    raise exception 'Launch date requires active status';
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    if old.status <> 'active' or new.completed_at is null or new.completed_at < old.actual_live_at or new.completed_at > now() then
      raise exception 'Only an active campaign can be completed with a valid actual date';
    end if;
  elsif new.completed_at is distinct from old.completed_at then
    raise exception 'Completion date requires completed status';
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_campaign_lifecycle() from public,anon,authenticated;
create trigger guard_campaign_lifecycle before insert or update on public.brand_campaigns
for each row execute function app_private.guard_campaign_lifecycle();

create or replace function public.transition_brand_campaign(target_campaign_id uuid,target_status text,event_at timestamptz)
returns void language plpgsql security definer set search_path = pg_catalog,public,app_private as $$
declare campaign public.brand_campaigns;
begin
  select * into campaign from public.brand_campaigns where id = target_campaign_id for update;
  if campaign.id is null or not app_private.is_brand_member(campaign.company_id) then raise exception 'Not authorized'; end if;
  if event_at is null or event_at > now() then raise exception 'Actual date required'; end if;
  if target_status = 'active' and campaign.status in ('draft','planning','ready_for_desk') then
    update public.brand_campaigns set status = 'active',actual_live_at = event_at,updated_at = now() where id = target_campaign_id;
  elsif target_status = 'completed' and campaign.status = 'active' then
    update public.brand_campaigns set status = 'completed',completed_at = event_at,updated_at = now() where id = target_campaign_id;
  else raise exception 'Invalid campaign transition'; end if;
end;
$$;
revoke all on function public.transition_brand_campaign(uuid,text,timestamptz) from public,anon;
grant execute on function public.transition_brand_campaign(uuid,text,timestamptz) to authenticated;
