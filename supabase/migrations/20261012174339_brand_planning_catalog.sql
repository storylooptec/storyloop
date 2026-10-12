-- Curated discovery, immutable rate snapshots, and revision-safe brief approval.
alter table public.brand_campaign_plans add column revision integer not null default 1 check (revision > 0);

create table public.brand_creator_catalog (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete restrict,
  display_name text not null check (length(display_name) between 1 and 160),
  bio text not null default '' check (length(bio) <= 1000),
  city text,
  categories text[] not null default '{}',
  languages text[] not null default '{}',
  profile_url text check (profile_url is null or profile_url ~ '^https://'),
  active boolean not null default false,
  directory_consented_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not active or (directory_consented_at is not null and published_at is not null))
);

create table public.brand_creator_rates (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.brand_creator_catalog(id) on delete cascade,
  deliverable_type text not null check (deliverable_type in ('instagram_reel','instagram_story','youtube_short','static_post')),
  unit_rate_cents bigint not null check (unit_rate_cents between 0 and 10000000000),
  currency text not null default 'INR' check (currency = 'INR'),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (catalog_id, deliverable_type)
);

create table public.brand_campaign_creator_selections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  catalog_id uuid not null references public.brand_creator_catalog(id) on delete restrict,
  rate_id uuid not null references public.brand_creator_rates(id) on delete restrict,
  creator_name_snapshot text not null,
  deliverable_type text not null check (deliverable_type in ('instagram_reel','instagram_story','youtube_short','static_post')),
  quantity integer not null check (quantity between 1 and 100),
  unit_rate_cents bigint not null check (unit_rate_cents between 0 and 10000000000),
  currency text not null default 'INR' check (currency = 'INR'),
  selected_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, rate_id)
);
create index brand_campaign_creator_selections_company_campaign_idx on public.brand_campaign_creator_selections(company_id, campaign_id);
create index brand_creator_rates_catalog_idx on public.brand_creator_rates(catalog_id) where active;

alter table public.brand_creator_catalog enable row level security;
alter table public.brand_creator_rates enable row level security;
alter table public.brand_campaign_creator_selections enable row level security;
grant select on public.brand_creator_catalog, public.brand_creator_rates, public.brand_campaign_creator_selections to authenticated;
grant insert, update, delete on public.brand_creator_catalog, public.brand_creator_rates to authenticated;

create policy "brand reads published consented catalog" on public.brand_creator_catalog for select to authenticated
using (
  app_private.is_storyloop_operator('operations.work')
  or (active and directory_consented_at <= now() and published_at <= now() and exists (
    select 1 from public.brand_memberships m where m.user_id = (select auth.uid()) and m.status = 'active'
  ))
);
create policy "operator curates creator catalog" on public.brand_creator_catalog for all to authenticated
using (app_private.is_storyloop_operator('approvals.perform'))
with check (app_private.is_storyloop_operator('approvals.perform'));
create policy "brand reads published creator rates" on public.brand_creator_rates for select to authenticated
using (
  app_private.is_storyloop_operator('operations.work')
  or (active and exists (select 1 from public.brand_creator_catalog c where c.id = catalog_id and c.active))
);
create policy "operator curates creator rates" on public.brand_creator_rates for all to authenticated
using (app_private.is_storyloop_operator('approvals.perform'))
with check (app_private.is_storyloop_operator('approvals.perform'));
create policy "brand reads own creator selections" on public.brand_campaign_creator_selections for select to authenticated
using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));

-- Only this RPC can persist a brand's plan. All ownership and evidence checks run under a row lock.
revoke insert, update, delete on public.brand_campaign_plans from authenticated;
create or replace function public.save_brand_campaign_brief(
  target_campaign_id uuid,
  expected_revision integer,
  updated_brief jsonb,
  approve boolean default false,
  source_model text default null
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  campaign public.brand_campaigns%rowtype;
  plan public.brand_campaign_plans%rowtype;
  claim jsonb;
  evidence_id text;
  claim_ids text[] := '{}';
  new_revision integer;
begin
  select * into campaign from public.brand_campaigns where id = target_campaign_id for update;
  if not found or not app_private.is_brand_member(campaign.company_id) then raise exception 'campaign_access'; end if;
  if campaign.status in ('active','completed','archived') then raise exception 'campaign_read_only'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'revision_conflict'; end if;
  if not exists (
    select 1 from public.brand_competitor_observations o
    join public.brand_competitor_scans s on s.id = o.scan_id and s.status = 'succeeded'
    join public.brand_competitors competitor on competitor.id = o.competitor_id and competitor.status = 'confirmed'
    where o.company_id = campaign.company_id and s.company_id = campaign.company_id and s.campaign_id = campaign.id
      and competitor.company_id = campaign.company_id and competitor.campaign_id = campaign.id
  ) then raise exception 'invalid_citations'; end if;
  select * into plan from public.brand_campaign_plans where campaign_id = target_campaign_id for update;
  if not found then
    if approve then raise exception 'no_plan'; end if;
    if expected_revision <> 0 then raise exception 'revision_conflict'; end if;
  elsif plan.company_id <> campaign.company_id then raise exception 'campaign_access';
  elsif plan.revision <> expected_revision then raise exception 'revision_conflict'; end if;

  if jsonb_typeof(updated_brief) <> 'object'
    or jsonb_typeof(updated_brief->'summary') is distinct from 'string'
    or length(btrim(updated_brief->>'summary')) not between 1 and 1200
    or jsonb_typeof(updated_brief->'recommended_angle') is distinct from 'string'
    or length(btrim(updated_brief->>'recommended_angle')) not between 1 and 700
    or jsonb_typeof(updated_brief->'creator_brief') is distinct from 'string'
    or length(btrim(updated_brief->>'creator_brief')) not between 1 and 1200
    or jsonb_typeof(updated_brief->'pain_areas') is distinct from 'array'
    or jsonb_typeof(updated_brief->'usp_hypotheses') is distinct from 'array'
    or jsonb_typeof(updated_brief->'must_include') is distinct from 'array'
    or jsonb_typeof(updated_brief->'must_avoid') is distinct from 'array'
  then raise exception 'invalid_brief'; end if;
  if jsonb_array_length(updated_brief->'pain_areas') > 8 or jsonb_array_length(updated_brief->'usp_hypotheses') > 8
    or jsonb_array_length(updated_brief->'must_include') > 12 or jsonb_array_length(updated_brief->'must_avoid') > 12
  then raise exception 'invalid_brief'; end if;
  for claim in select value from jsonb_array_elements((updated_brief->'must_include') || (updated_brief->'must_avoid')) loop
    if jsonb_typeof(claim) <> 'string' or length(claim #>> '{}') not between 1 and 300 then raise exception 'invalid_brief'; end if;
  end loop;
  for claim in select value from jsonb_array_elements((updated_brief->'pain_areas') || (updated_brief->'usp_hypotheses')) loop
    if jsonb_typeof(claim) <> 'object' or jsonb_typeof(claim->'statement') is distinct from 'string'
      or length(btrim(claim->>'statement')) not between 1 and 700
      or jsonb_typeof(claim->'id') is distinct from 'string'
      or not (claim->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$')
      or (claim->>'id') = any(claim_ids)
      or jsonb_typeof(claim->'evidence_ids') is distinct from 'array'
    then raise exception 'invalid_brief'; end if;
    claim_ids := array_append(claim_ids, claim->>'id');
    if jsonb_array_length(claim->'evidence_ids') not between 1 and 20 then raise exception 'invalid_citations'; end if;
    for evidence_id in select jsonb_array_elements_text(claim->'evidence_ids') loop
      if not exists (
        select 1 from public.brand_competitor_observations o
        join public.brand_competitor_scans s on s.id = o.scan_id
        join public.brand_competitors competitor on competitor.id = o.competitor_id and competitor.status = 'confirmed'
          and competitor.company_id = campaign.company_id and competitor.campaign_id = campaign.id
        where o.id::text = evidence_id and o.company_id = campaign.company_id
          and s.campaign_id = campaign.id and s.company_id = campaign.company_id and s.status = 'succeeded'
      ) then raise exception 'invalid_citations'; end if;
      if exists (select 1 from jsonb_array_elements(updated_brief->'pain_areas') p where p->>'id' = claim->>'id')
        and not exists (select 1 from public.brand_competitor_observations o where o.id::text = evidence_id and o.evidence_kind in ('reddit_excerpt','amazon_review'))
      then raise exception 'invalid_citations'; end if;
    end loop;
  end loop;

  new_revision := coalesce(plan.revision, 0) + 1;
  insert into public.brand_campaign_plans (campaign_id,company_id,brief,approval_state,approved_at,generated_model,generated_at,updated_at,revision)
  values (campaign.id,campaign.company_id,updated_brief,case when approve then 'approved' else 'draft' end,
    case when approve then now() else null end,source_model,case when source_model is not null then now() else null end,now(),new_revision)
  on conflict (campaign_id) do update set brief = excluded.brief, approval_state = excluded.approval_state,
    approved_at = excluded.approved_at, updated_at = excluded.updated_at, revision = excluded.revision,
    generated_model = coalesce(excluded.generated_model,brand_campaign_plans.generated_model),
    generated_at = coalesce(excluded.generated_at,brand_campaign_plans.generated_at);
  update public.brand_campaigns set status = case when approve then 'ready_for_desk' else 'planning' end, updated_at = now() where id = campaign.id;
  return new_revision;
end;
$$;
revoke all on function public.save_brand_campaign_brief(uuid,integer,jsonb,boolean,text) from public, anon;
grant execute on function public.save_brand_campaign_brief(uuid,integer,jsonb,boolean,text) to authenticated;

create or replace function app_private.invalidate_creatives_on_brief_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.brief is distinct from old.brief or (old.approval_state = 'approved' and new.approval_state <> 'approved') then
    update public.brand_campaign_creatives set approval_state = 'draft', updated_at = now()
    where campaign_id = new.campaign_id and company_id = new.company_id;
  end if;
  return new;
end;
$$;
revoke all on function app_private.invalidate_creatives_on_brief_change() from public, anon, authenticated;
create trigger invalidate_creatives_after_brief_change after update on public.brand_campaign_plans
for each row execute function app_private.invalidate_creatives_on_brief_change();

create or replace function public.set_brand_creator_selection(target_campaign_id uuid,target_rate_id uuid,target_quantity integer,expected_rate_cents bigint default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare
  campaign public.brand_campaigns%rowtype;
  rate public.brand_creator_rates%rowtype;
  creator public.brand_creator_catalog%rowtype;
  selected_id uuid;
begin
  select * into campaign from public.brand_campaigns where id = target_campaign_id for update;
  if not found or not app_private.is_brand_member(campaign.company_id) then raise exception 'campaign_access'; end if;
  if campaign.status in ('active','completed','archived') then raise exception 'campaign_read_only'; end if;
  if target_quantity is null or target_quantity not between 0 and 100 then raise exception 'invalid_quantity'; end if;
  if target_quantity = 0 then
    delete from public.brand_campaign_creator_selections where campaign_id = campaign.id and company_id = campaign.company_id and rate_id = target_rate_id returning id into selected_id;
    return selected_id;
  end if;
  if not exists (select 1 from public.brand_campaign_plans where campaign_id = campaign.id and company_id = campaign.company_id and approval_state = 'approved') then raise exception 'brief_not_approved'; end if;
  if not exists (select 1 from public.brand_campaign_creator_selections where campaign_id = campaign.id and rate_id = target_rate_id)
    and (select count(*) from public.brand_campaign_creator_selections where campaign_id = campaign.id) >= 100
  then raise exception 'selection_limit'; end if;
  select * into rate from public.brand_creator_rates where id = target_rate_id and active for share;
  if not found then raise exception 'rate_unavailable'; end if;
  if expected_rate_cents is null or expected_rate_cents <> rate.unit_rate_cents then raise exception 'rate_changed'; end if;
  if not rate.deliverable_type = any(campaign.deliverables) then raise exception 'deliverable_mismatch'; end if;
  select * into creator from public.brand_creator_catalog where id = rate.catalog_id and active and directory_consented_at <= now() and published_at <= now() for share;
  if not found then raise exception 'creator_unavailable'; end if;
  insert into public.brand_campaign_creator_selections (company_id,campaign_id,catalog_id,rate_id,creator_name_snapshot,deliverable_type,quantity,unit_rate_cents,currency,selected_by)
  values(campaign.company_id,campaign.id,creator.id,rate.id,creator.display_name,rate.deliverable_type,target_quantity,rate.unit_rate_cents,rate.currency,auth.uid())
  on conflict(campaign_id,rate_id) do update set quantity = excluded.quantity,unit_rate_cents = excluded.unit_rate_cents,
    creator_name_snapshot = excluded.creator_name_snapshot,selected_by = excluded.selected_by,updated_at = now()
  returning id into selected_id;
  update public.brand_campaigns set updated_at = now() where id = campaign.id;
  return selected_id;
end;
$$;
revoke all on function public.set_brand_creator_selection(uuid,uuid,integer,bigint) from public, anon;
grant execute on function public.set_brand_creator_selection(uuid,uuid,integer,bigint) to authenticated;

-- Cross-company history is exposed only as a fixed aggregate with at least 5 distinct completed campaigns.
create or replace function public.get_brand_campaign_benchmarks(target_campaign_id uuid)
returns table (deliverable_type text,campaign_count bigint,median_unit_rate_cents numeric,p25_unit_rate_cents numeric,p75_unit_rate_cents numeric)
language plpgsql stable security definer set search_path = pg_catalog, public, app_private as $$
declare campaign public.brand_campaigns%rowtype;
begin
  select * into campaign from public.brand_campaigns where id = target_campaign_id;
  if not found or not app_private.is_brand_member(campaign.company_id) then raise exception 'campaign_access'; end if;
  return query
    with campaign_rates as (
      select s.deliverable_type, c.id,
        sum(s.unit_rate_cents::numeric * s.quantity) / nullif(sum(s.quantity),0) as unit_rate
      from public.brand_campaign_creator_selections s join public.brand_campaigns c on c.id = s.campaign_id and c.company_id = s.company_id
      where c.status = 'completed' and c.objective = campaign.objective and c.id <> campaign.id
        and s.currency = 'INR' and s.deliverable_type = any(campaign.deliverables)
      group by s.deliverable_type,c.id
    )
    select r.deliverable_type,count(*)::bigint,
      percentile_cont(0.5) within group (order by r.unit_rate)::numeric,
      percentile_cont(0.25) within group (order by r.unit_rate)::numeric,
      percentile_cont(0.75) within group (order by r.unit_rate)::numeric
    from campaign_rates r group by r.deliverable_type having count(*) >= 5;
end;
$$;
revoke all on function public.get_brand_campaign_benchmarks(uuid) from public, anon;
grant execute on function public.get_brand_campaign_benchmarks(uuid) to authenticated;

-- Rejected or corrected competitor identities cannot leave an evidence-dependent brief approved.
create or replace function app_private.invalidate_brief_on_competitor_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare invalidated integer;
begin
  if old.status = 'confirmed' and (new.status <> 'confirmed' or new.name is distinct from old.name or new.official_domain is distinct from old.official_domain) then
    -- Serialize the plan update with brief saves and launch.
    perform 1 from public.brand_campaigns c where c.id = old.campaign_id and c.company_id = old.company_id
      and c.status not in ('active','completed','archived') for update;
    if not found then return new; end if;
    update public.brand_campaign_plans p set approval_state = 'draft', approved_at = null, revision = revision + 1, updated_at = now()
    where p.campaign_id = old.campaign_id and p.company_id = old.company_id and p.approval_state = 'approved'
      and exists (
        select 1 from public.brand_competitor_observations o
        where o.competitor_id = old.id and o.company_id = old.company_id
          and exists (
            select 1 from jsonb_array_elements(coalesce(p.brief->'pain_areas','[]'::jsonb) || coalesce(p.brief->'usp_hypotheses','[]'::jsonb)) claim
            where (claim->'evidence_ids') ? o.id::text
          )
      );
    get diagnostics invalidated = row_count;
    if invalidated > 0 then
      update public.brand_campaigns set status = 'planning', updated_at = now() where id = old.campaign_id and company_id = old.company_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.invalidate_brief_on_competitor_change() from public, anon, authenticated;
create trigger invalidate_brief_after_competitor_change after update on public.brand_competitors
for each row execute function app_private.invalidate_brief_on_competitor_change();
