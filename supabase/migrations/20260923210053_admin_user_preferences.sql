create table if not exists public.admin_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_user_preferences enable row level security;

grant select, insert, update on public.admin_user_preferences to authenticated;

create policy "users can read own admin preferences"
on public.admin_user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert own admin preferences"
on public.admin_user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update own admin preferences"
on public.admin_user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
