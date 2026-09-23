create type public.team_role as enum ('junior', 'senior');

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_role not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table public.role_permissions (
  role public.team_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  ('junior', 'operations.work'),
  ('junior', 'drafts.manage'),
  ('junior', 'reversible_actions.perform'),
  ('junior', 'discovery.within_cap'),
  ('senior', 'operations.work'),
  ('senior', 'drafts.manage'),
  ('senior', 'reversible_actions.perform'),
  ('senior', 'discovery.within_cap'),
  ('senior', 'communications.send'),
  ('senior', 'approvals.perform'),
  ('senior', 'creator.verified_grant'),
  ('senior', 'financial_actions.perform'),
  ('senior', 'caps.override');

alter table public.team_memberships enable row level security;
alter table public.role_permissions enable row level security;

grant select on public.team_memberships to authenticated;
grant select on public.role_permissions to authenticated;

create schema if not exists app_private;

create or replace function app_private.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.team_memberships tm
      where tm.company_id = target_company_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
    );
$$;

create or replace function app_private.has_company_permission(
  target_company_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.team_memberships tm
      join public.role_permissions rp
        on rp.role = tm.role
      where tm.company_id = target_company_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and rp.permission = required_permission
    );
$$;

revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

revoke all on function app_private.is_company_member(uuid) from public, anon;
revoke all on function app_private.has_company_permission(uuid, text) from public, anon;

grant execute on function app_private.is_company_member(uuid) to authenticated;
grant execute on function app_private.has_company_permission(uuid, text) to authenticated;

create policy "members can read their company"
on public.companies
for select
to authenticated
using (app_private.is_company_member(id));

create policy "members can read company creator relationships"
on public.company_creators
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "members with operational permission can insert company creator relationships"
on public.company_creators
for insert
to authenticated
with check (app_private.has_company_permission(company_id, 'operations.work'));

create policy "members with operational permission can update company creator relationships"
on public.company_creators
for update
to authenticated
using (app_private.has_company_permission(company_id, 'operations.work'))
with check (app_private.has_company_permission(company_id, 'operations.work'));

create policy "members with operational permission can delete company creator relationships"
on public.company_creators
for delete
to authenticated
using (app_private.has_company_permission(company_id, 'reversible_actions.perform'));

create policy "members can read linked creators"
on public.creators
for select
to authenticated
using (
  exists (
    select 1
    from public.company_creators cc
    where cc.creator_id = creators.id
      and app_private.is_company_member(cc.company_id)
  )
);

create policy "members can read company team"
on public.team_memberships
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "authenticated users can read role permissions"
on public.role_permissions
for select
to authenticated
using (true);

grant select on public.companies to authenticated;
grant select on public.creators to authenticated;
grant select, insert, update, delete on public.company_creators to authenticated;
