create table public.creator_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  phone text,
  tier text not null default 'free' check (tier in ('free','paid','exclusive')),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 9),
  onboarding_completed boolean not null default false,
  onboarding_data jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  entitlement_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  profile_url text not null,
  platform text,
  handle text,
  is_primary boolean not null default false,
  verification_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, profile_url)
);

create table public.creator_create_usage (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  month_start date not null,
  captions_used integer not null default 0 check (captions_used >= 0),
  hashtags_used integer not null default 0 check (hashtags_used >= 0),
  updated_at timestamptz not null default now(),
  unique (creator_id, month_start)
);

create table public.creator_studio_profiles (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  setup_status text not null default 'not_started' check (setup_status in ('not_started','voice_pending','photos_pending','consent_pending','ready','revoked')),
  voice_captured boolean not null default false,
  photos_captured integer not null default 0 check (photos_captured between 0 and 6),
  consent_scope text check (consent_scope in ('self_only','brand_requests')),
  consented_at timestamptz,
  model_status text not null default 'not_created',
  updated_at timestamptz not null default now()
);

alter table public.creator_accounts enable row level security;
alter table public.creator_social_accounts enable row level security;
alter table public.creator_create_usage enable row level security;
alter table public.creator_studio_profiles enable row level security;

grant select, update on public.creator_accounts to authenticated;
grant select, insert, update, delete on public.creator_social_accounts to authenticated;
grant select, insert, update on public.creator_create_usage to authenticated;
grant select, insert, update on public.creator_studio_profiles to authenticated;

create policy "creator reads own account" on public.creator_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "creator updates own account" on public.creator_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function app_private.is_creator_owner(target_creator_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.creator_accounts ca
    where ca.creator_id = target_creator_id and ca.user_id = (select auth.uid())
  );
$$;

revoke all on function app_private.is_creator_owner(uuid) from public;
grant execute on function app_private.is_creator_owner(uuid) to authenticated;

create policy "creator reads own creator record" on public.creators for select to authenticated using (app_private.is_creator_owner(id));
create policy "creator updates own creator record" on public.creators for update to authenticated using (app_private.is_creator_owner(id)) with check (app_private.is_creator_owner(id));
create policy "creator reads own social accounts" on public.creator_social_accounts for select to authenticated using (app_private.is_creator_owner(creator_id));
create policy "creator inserts own social accounts" on public.creator_social_accounts for insert to authenticated with check (app_private.is_creator_owner(creator_id));
create policy "creator updates own social accounts" on public.creator_social_accounts for update to authenticated using (app_private.is_creator_owner(creator_id)) with check (app_private.is_creator_owner(creator_id));
create policy "creator deletes own social accounts" on public.creator_social_accounts for delete to authenticated using (app_private.is_creator_owner(creator_id));
create policy "creator reads own create usage" on public.creator_create_usage for select to authenticated using (app_private.is_creator_owner(creator_id));
create policy "creator inserts own create usage" on public.creator_create_usage for insert to authenticated with check (app_private.is_creator_owner(creator_id));
create policy "creator updates own create usage" on public.creator_create_usage for update to authenticated using (app_private.is_creator_owner(creator_id)) with check (app_private.is_creator_owner(creator_id));
create policy "creator reads own studio profile" on public.creator_studio_profiles for select to authenticated using (app_private.is_creator_owner(creator_id));
create policy "creator inserts own studio profile" on public.creator_studio_profiles for insert to authenticated with check (app_private.is_creator_owner(creator_id));
create policy "creator updates own studio profile" on public.creator_studio_profiles for update to authenticated using (app_private.is_creator_owner(creator_id)) with check (app_private.is_creator_owner(creator_id));
create policy "creator reads own company relationship" on public.company_creators for select to authenticated using (app_private.is_creator_owner(creator_id));

create or replace function public.ensure_creator_account(p_phone text default null, p_source text default null)
returns uuid language plpgsql security definer set search_path = public, app_private as $$
declare
  v_user_id uuid := (select auth.uid());
  v_creator_id uuid;
  v_company_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select creator_id into v_creator_id from public.creator_accounts where user_id = v_user_id;
  if v_creator_id is not null then
    if p_phone is not null then update public.creator_accounts set phone = p_phone, updated_at = now() where user_id = v_user_id; end if;
    return v_creator_id;
  end if;
  select id into v_company_id from public.companies where slug = 'storyloop' and status = 'active' limit 1;
  if v_company_id is null then raise exception 'Storyloop company is unavailable'; end if;
  insert into public.creators (metadata) values ('{}'::jsonb) returning id into v_creator_id;
  insert into public.creator_accounts (user_id, creator_id, company_id, phone, onboarding_data)
  values (v_user_id, v_creator_id, v_company_id, p_phone, jsonb_build_object('source', p_source));
  return v_creator_id;
end;
$$;

revoke all on function public.ensure_creator_account(text,text) from public;
grant execute on function public.ensure_creator_account(text,text) to authenticated;

create or replace function public.complete_creator_onboarding()
returns uuid language plpgsql security definer set search_path = public, app_private as $$
declare
  v_user_id uuid := (select auth.uid());
  v_creator_id uuid;
  v_company_id uuid;
  v_source text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select creator_id, company_id, onboarding_data->>'source' into v_creator_id, v_company_id, v_source
  from public.creator_accounts where user_id = v_user_id;
  if v_creator_id is null then raise exception 'Creator account is unavailable'; end if;
  update public.creator_accounts set onboarding_completed = true, onboarding_step = 9, updated_at = now() where user_id = v_user_id;
  insert into public.company_creators (company_id, creator_id, status, source, commercial_relationship)
  values (v_company_id, v_creator_id, 'active', v_source, 'creator_hub') on conflict do nothing;
  return v_creator_id;
end;
$$;

revoke all on function public.complete_creator_onboarding() from public;
grant execute on function public.complete_creator_onboarding() to authenticated;

insert into public.company_configuration (company_id, key, category, label, description, value_type, value, is_tbd)
select c.id, v.key, 'creator', v.label, v.description, v.value_type::public.configuration_value_type, null, true
from public.companies c
cross join (values
 ('creator_verified_criteria','Creator Verified criteria','O3 — criteria and granting authority remain open.','string'),
 ('creator_age_verification_method','Creator age verification method','O4 — tap declaration vs year-of-birth vs deferred KYC remains open.','string'),
 ('creator_rate_slider_anchor','Creator rate slider anchor','O5 — off-anchor vs required touch remains open.','string'),
 ('creator_ai_disclosure_requirement','Creator AI disclosure requirement','O6 — disclosure beyond watermark remains open.','string'),
 ('creator_exclusive_entry_criteria','Exclusive entry criteria','O7 — invitation/application criteria remain open.','string'),
 ('creator_public_profile_enabled','Creator public profile','O8 — public profile decision remains open.','boolean'),
 ('creator_under18_retention_policy','Under-18 retention policy','O9 — delete immediately vs hold return date remains open.','string')
) as v(key,label,description,value_type)
where c.slug = 'storyloop'
on conflict (company_id, key) do nothing;
