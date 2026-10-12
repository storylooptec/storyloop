-- Approved creative revisions and per-request, revocable creator consent.
alter table public.brand_campaign_creatives
  add column revision integer not null default 1 check (revision > 0),
  add column plan_revision integer,
  add column plan_updated_at timestamptz,
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users(id);
revoke insert, update on public.brand_campaign_creatives from authenticated;

create table public.brand_preview_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  campaign_id uuid not null references public.brand_campaigns(id),
  creative_id uuid not null references public.brand_campaign_creatives(id),
  creative_revision integer not null check (creative_revision > 0),
  creator_id uuid references public.creators(id),
  kind text not null check (kind in ('image','video')),
  campaign_title text not null,
  brand_name text not null,
  prompt text not null check (length(prompt) between 20 and 4000),
  request_hash text not null,
  status text not null check (status in ('awaiting_consent','approved','rejected','revoked')),
  reference_object_key text,
  reference_sha256 text,
  consented_at timestamptz,
  consented_by uuid references auth.users(id),
  consent_version text,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_id is null or kind = 'image'),
  check (status <> 'approved' or creator_id is null or (reference_object_key is not null and reference_sha256 is not null and consented_by is not null))
);
create index brand_preview_requests_campaign_idx on public.brand_preview_requests(campaign_id, created_at desc);
create index brand_preview_requests_creator_idx on public.brand_preview_requests(creator_id, status);

create table public.brand_preview_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.brand_preview_requests(id),
  company_id uuid not null references public.companies(id),
  campaign_id uuid not null references public.brand_campaigns(id),
  model text not null,
  kind text not null check (kind in ('image','video')),
  status text not null check (status in ('quoted','submitting','submission_unknown','queued','in_progress','completed_pending_archive','completed','failed','nsfw','canceled','expired')),
  estimated_cost_usd numeric(12,6) not null check (estimated_cost_usd >= 0),
  estimated_credits numeric(12,4) not null check (estimated_credits >= 0),
  quote_expires_at timestamptz not null,
  provider_request_id text,
  failure_code text,
  media_object_key text,
  media_content_type text,
  last_polled_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_preview_one_active_campaign_idx on public.brand_preview_jobs(campaign_id)
  where status in ('submitting','submission_unknown','queued','in_progress');
create index brand_preview_jobs_campaign_idx on public.brand_preview_jobs(campaign_id, created_at desc);

-- Signed reference URLs and provider URLs are never exposed to a browser or public client.
create table public.brand_preview_job_private (
  job_id uuid primary key references public.brand_preview_jobs(id) on delete cascade,
  idempotency_key uuid not null unique default gen_random_uuid(),
  request_payload jsonb not null,
  status_url text,
  output_url text
);
alter table public.brand_preview_requests enable row level security;
alter table public.brand_preview_jobs enable row level security;
alter table public.brand_preview_job_private enable row level security;
revoke all on public.brand_preview_requests, public.brand_preview_jobs, public.brand_preview_job_private from anon, authenticated;
grant select on public.brand_preview_requests, public.brand_preview_jobs to authenticated;
create policy "members and requested creator read preview requests" on public.brand_preview_requests for select to authenticated
using (app_private.is_brand_member(company_id) or (creator_id is not null and app_private.is_creator_owner(creator_id)));
create policy "members and requested creator read preview jobs" on public.brand_preview_jobs for select to authenticated
using (app_private.is_brand_member(company_id) or exists (
  select 1 from public.brand_preview_requests r where r.id = request_id and r.creator_id is not null and app_private.is_creator_owner(r.creator_id)
));

create function public.save_brand_creative(p_creative_id uuid, p_revision integer, p_content jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare c public.brand_campaign_creatives; p public.brand_campaign_plans; campaign public.brand_campaigns; item jsonb; key text;
begin
  select * into c from public.brand_campaign_creatives where id = p_creative_id;
  if c.id is null or not app_private.is_brand_member(c.company_id) then raise exception 'Creative unavailable'; end if;
  select * into campaign from public.brand_campaigns where id = c.campaign_id for update;
  select * into p from public.brand_campaign_plans where campaign_id = c.campaign_id for update;
  select * into c from public.brand_campaign_creatives where id = p_creative_id for update;
  if campaign.status in ('active','completed','archived') then raise exception 'Campaign is read-only'; end if;
  if c.revision is distinct from p_revision then raise exception 'Creative changed; reload'; end if;
  if p.id is null or p.approval_state is distinct from 'approved' or c.plan_revision is distinct from p.revision then raise exception 'Approved brief changed'; end if;
  if jsonb_typeof(p_content->'concepts') is distinct from 'array' or jsonb_array_length(p_content->'concepts') <> 3 then raise exception 'Three concepts required'; end if;
  for item in select value from jsonb_array_elements(p_content->'concepts') loop
    foreach key in array array['angle','hook','script','cta','format'] loop
      if jsonb_typeof(item->key) is distinct from 'string' or length(btrim(item->>key)) = 0
        or length(item->>key) > (case when key = 'script' then 3000 when key = 'format' then 120 else 500 end) then raise exception 'Invalid creative'; end if;
    end loop;
  end loop;
  update public.brand_campaign_creatives set content = p_content, revision = revision + 1, approval_state = 'draft', approved_at = null, approved_by = null, updated_at = now() where id = c.id;
  update public.brand_preview_requests set status = 'revoked', updated_at = now() where creative_id = c.id and status in ('approved','awaiting_consent');
end;
$$;

create function public.approve_brand_creative(p_creative_id uuid, p_revision integer)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare c public.brand_campaign_creatives; p public.brand_campaign_plans; campaign public.brand_campaigns;
begin
  select * into c from public.brand_campaign_creatives where id = p_creative_id;
  if c.id is null or not app_private.is_brand_member(c.company_id) then raise exception 'Creative unavailable'; end if;
  select * into campaign from public.brand_campaigns where id = c.campaign_id for update;
  select * into p from public.brand_campaign_plans where campaign_id = c.campaign_id for update;
  select * into c from public.brand_campaign_creatives where id = p_creative_id for update;
  if campaign.status in ('active','completed','archived') then raise exception 'Campaign is read-only'; end if;
  if c.revision is distinct from p_revision or p.id is null or p.approval_state is distinct from 'approved' or c.plan_revision is distinct from p.revision then raise exception 'Creative or brief changed'; end if;
  if jsonb_typeof(c.content->'concepts') is distinct from 'array' or jsonb_array_length(c.content->'concepts') <> 3 then raise exception 'Three concepts required'; end if;
  update public.brand_campaign_creatives set approval_state = 'approved', approved_at = now(), approved_by = auth.uid(), updated_at = now() where id = c.id;
end;
$$;
revoke all on function public.save_brand_creative(uuid,integer,jsonb), public.approve_brand_creative(uuid,integer) from public, anon;
grant execute on function public.save_brand_creative(uuid,integer,jsonb), public.approve_brand_creative(uuid,integer) to authenticated;

create function app_private.invalidate_preview_consent_on_plan_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.revision is distinct from old.revision then
    update public.brand_preview_requests set status = 'revoked', updated_at = now()
      where campaign_id = new.campaign_id and status in ('approved','awaiting_consent');
  end if;
  return new;
end;
$$;
create trigger brand_plan_revokes_preview_consent after update on public.brand_campaign_plans
for each row execute function app_private.invalidate_preview_consent_on_plan_change();

-- Composite keys prevent a trusted write from attaching another tenant's creative or job.
alter table public.brand_campaign_creatives add constraint brand_creatives_id_campaign_company_key unique(id,campaign_id,company_id);
alter table public.brand_campaign_creatives add constraint brand_creatives_campaign_company_fkey foreign key(campaign_id,company_id) references public.brand_campaigns(id,company_id);
alter table public.brand_preview_requests add constraint brand_preview_request_creative_scope_fkey foreign key(creative_id,campaign_id,company_id) references public.brand_campaign_creatives(id,campaign_id,company_id);
alter table public.brand_preview_requests add constraint brand_preview_request_scope_key unique(id,campaign_id,company_id);
alter table public.brand_preview_jobs add constraint brand_preview_job_request_scope_fkey foreign key(request_id,campaign_id,company_id) references public.brand_preview_requests(id,campaign_id,company_id);

create function app_private.validate_new_brand_creative()
returns trigger language plpgsql security definer set search_path = public as $$
declare campaign public.brand_campaigns; plan public.brand_campaign_plans;
begin
  select * into campaign from public.brand_campaigns where id = new.campaign_id and company_id = new.company_id for update;
  select * into plan from public.brand_campaign_plans where campaign_id = new.campaign_id for update;
  if campaign.id is null or campaign.status in ('active','completed','archived') then raise exception 'Campaign is read-only or unavailable'; end if;
  if plan.id is null or plan.approval_state is distinct from 'approved' or new.plan_revision is distinct from plan.revision then raise exception 'Approved brief changed'; end if;
  if new.approval_state <> 'draft' or new.approved_at is not null or new.approved_by is not null then raise exception 'New creative requires review'; end if;
  return new;
end;
$$;
create trigger validate_new_brand_creative before insert on public.brand_campaign_creatives for each row execute function app_private.validate_new_brand_creative();
