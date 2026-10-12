create table public.brand_campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  generated_model text,
  approval_state text not null default 'draft' check (approval_state in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_campaign_creatives_campaign_created_idx
  on public.brand_campaign_creatives(campaign_id, created_at desc);

alter table public.brand_campaign_creatives enable row level security;
grant select, insert, update on public.brand_campaign_creatives to authenticated;

create policy "brand members read their creative drafts"
on public.brand_campaign_creatives for select to authenticated
using (app_private.is_brand_member(company_id));

create policy "brand members create creative drafts"
on public.brand_campaign_creatives for insert to authenticated
with check (
  app_private.is_brand_member(company_id)
  and exists (
    select 1 from public.brand_campaigns c
    where c.id = brand_campaign_creatives.campaign_id
      and c.company_id = brand_campaign_creatives.company_id
  )
);

create policy "brand members update creative drafts"
on public.brand_campaign_creatives for update to authenticated
using (app_private.is_brand_member(company_id))
with check (
  app_private.is_brand_member(company_id)
  and exists (
    select 1 from public.brand_campaigns c
    where c.id = brand_campaign_creatives.campaign_id
      and c.company_id = brand_campaign_creatives.company_id
  )
);
