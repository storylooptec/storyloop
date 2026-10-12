-- Search evidence is written only by the trusted server after membership checks.
revoke insert, update, delete on public.brand_competitor_scans from authenticated;
revoke insert, update, delete on public.brand_competitor_observations from authenticated;
grant all on public.brand_competitor_scans, public.brand_competitor_observations to service_role;

create unique index if not exists brand_campaigns_id_company_competition_uq on public.brand_campaigns(id, company_id);
create unique index if not exists brand_scans_id_company_campaign_uq on public.brand_competitor_scans(id, company_id, campaign_id);

create table public.brand_competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null,
  scan_id uuid not null,
  name text not null check (char_length(name) between 2 and 100),
  official_domain text not null check (char_length(official_domain) between 4 and 253),
  rationale text not null check (char_length(rationale) <= 600),
  status text not null default 'candidate' check (status in ('candidate', 'confirmed', 'rejected')),
  evidence_ids uuid[] not null default '{}',
  verified_at timestamptz not null,
  confirmed_at timestamptz,
  enrichment_status text not null default 'idle' check (enrichment_status in ('idle', 'running', 'succeeded', 'failed')),
  enrichment_started_at timestamptz,
  enriched_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, company_id) references public.brand_campaigns(id, company_id) on delete cascade,
  foreign key (scan_id, company_id, campaign_id) references public.brand_competitor_scans(id, company_id, campaign_id) on delete cascade,
  unique (scan_id, official_domain),
  unique (id, company_id, campaign_id)
);
create index brand_competitors_campaign_status_idx on public.brand_competitors(company_id, campaign_id, status);

alter table public.brand_competitor_observations
  add column competitor_id uuid references public.brand_competitors(id) on delete cascade,
  add column evidence_kind text not null default 'discovery' check (evidence_kind in ('discovery', 'official_site', 'reddit_excerpt', 'amazon_product', 'amazon_review')),
  add column source_record_key text,
  add column source_date_text text,
  add column provider_search_id text,
  add column attributes jsonb not null default '{}'::jsonb;
update public.brand_competitor_observations set source_record_key = source_url;
alter table public.brand_competitor_observations alter column source_record_key set not null;
alter table public.brand_competitor_observations drop constraint if exists brand_competitor_observations_scan_id_source_url_key;
create unique index brand_observations_scan_record_uq on public.brand_competitor_observations(scan_id, source_record_key);
create index brand_observations_competitor_idx on public.brand_competitor_observations(competitor_id);

create table public.brand_search_cache (
  company_id uuid not null references public.companies(id) on delete cascade,
  cache_key text not null,
  engine text not null check (engine in ('google', 'google_forums', 'amazon', 'amazon_product')),
  payload jsonb not null,
  provider_search_id text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (company_id, cache_key)
);
create index brand_search_cache_expiry_idx on public.brand_search_cache(expires_at);

create table public.brand_competitor_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null,
  competitor_id uuid not null,
  scan_id uuid not null,
  asin text not null check (asin ~ '^[A-Z0-9]{10}$'),
  amazon_domain text not null default 'amazon.in' check (amazon_domain = 'amazon.in'),
  title text not null,
  source_url text not null,
  rating numeric check (rating between 0 and 5),
  review_count integer check (review_count >= 0),
  price numeric check (price >= 0),
  price_text text,
  currency text,
  status text not null default 'candidate' check (status in ('candidate', 'selected')),
  observed_at timestamptz not null,
  provider_search_id text,
  unique (competitor_id, asin),
  foreign key (campaign_id, company_id) references public.brand_campaigns(id, company_id) on delete cascade,
  foreign key (competitor_id, company_id, campaign_id) references public.brand_competitors(id, company_id, campaign_id) on delete cascade,
  foreign key (scan_id, company_id, campaign_id) references public.brand_competitor_scans(id, company_id, campaign_id) on delete cascade
);
create index brand_competitor_products_company_campaign_idx on public.brand_competitor_products(company_id, campaign_id);

alter table public.brand_competitors enable row level security;
alter table public.brand_search_cache enable row level security;
alter table public.brand_competitor_products enable row level security;
grant select on public.brand_competitors, public.brand_search_cache, public.brand_competitor_products to authenticated;
grant all on public.brand_competitors, public.brand_search_cache, public.brand_competitor_products to service_role;
create policy "brand members read scoped competitors" on public.brand_competitors for select to authenticated
  using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));
create policy "brand members read scoped search cache" on public.brand_search_cache for select to authenticated
  using (app_private.is_brand_member(company_id));
create policy "brand members read scoped product candidates" on public.brand_competitor_products for select to authenticated
  using (app_private.is_brand_member(company_id) or app_private.is_storyloop_operator('operations.work'));

-- Serialize shortlist edits with launch and enforce the five-active-brand bound under concurrent requests.
create or replace function app_private.guard_brand_research_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare campaign_state text;
begin
  select status into campaign_state from public.brand_campaigns
    where id = new.campaign_id and company_id = new.company_id for update;
  if campaign_state is null or campaign_state in ('active', 'completed', 'archived') then
    raise exception 'campaign_read_only';
  end if;
  if tg_table_name = 'brand_competitors' and new.status <> 'rejected' then
    if (select count(*) from public.brand_competitors where scan_id = new.scan_id and status <> 'rejected' and id <> new.id) >= 5 then
      raise exception 'five_competitors';
    end if;
  end if;
  return new;
end;
$$;
create trigger brand_competitors_edit_guard before insert or update on public.brand_competitors
  for each row execute function app_private.guard_brand_research_mutation();
create trigger brand_competitor_products_edit_guard before insert or update on public.brand_competitor_products
  for each row execute function app_private.guard_brand_research_mutation();

-- Refuse tenant-mismatched service inserts and accidental mutation of saved evidence.
create or replace function app_private.validate_brand_observation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare campaign_state text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Search observations are immutable; insert a new scan instead';
  end if;
  if not exists (select 1 from public.brand_competitor_scans s where s.id = new.scan_id and s.company_id = new.company_id) then
    raise exception 'Observation does not belong to this company';
  end if;
  select c.status into campaign_state from public.brand_campaigns c
    join public.brand_competitor_scans s on s.campaign_id = c.id and s.company_id = c.company_id
    where s.id = new.scan_id and s.company_id = new.company_id for update of c;
  if campaign_state is null or campaign_state in ('active', 'completed', 'archived') then
    raise exception 'campaign_read_only';
  end if;
  if new.competitor_id is not null and not exists (
    select 1 from public.brand_competitors c where c.id = new.competitor_id and c.scan_id = new.scan_id and c.company_id = new.company_id
  ) then
    raise exception 'Observation does not belong to this competitor scan';
  end if;
  return new;
end;
$$;
create trigger brand_observations_immutable before insert or update on public.brand_competitor_observations
  for each row execute function app_private.validate_brand_observation();
