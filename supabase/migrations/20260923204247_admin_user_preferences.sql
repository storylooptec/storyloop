create table public.admin_user_preferences (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

alter table public.admin_user_preferences enable row level security;

grant select, insert, update on public.admin_user_preferences to authenticated;

create policy "users can read their admin preferences"
on public.admin_user_preferences
for select
to authenticated
using (
  user_id = (select auth.uid())
  and app_private.is_company_member(company_id)
);

create policy "users can create their admin preferences"
on public.admin_user_preferences
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and app_private.is_company_member(company_id)
);

create policy "users can update their admin preferences"
on public.admin_user_preferences
for update
to authenticated
using (
  user_id = (select auth.uid())
  and app_private.is_company_member(company_id)
)
with check (
  user_id = (select auth.uid())
  and app_private.is_company_member(company_id)
);
