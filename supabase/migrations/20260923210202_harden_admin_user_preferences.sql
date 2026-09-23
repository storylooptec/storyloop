drop policy if exists "users can read own admin preferences" on public.admin_user_preferences;
drop policy if exists "users can insert own admin preferences" on public.admin_user_preferences;
drop policy if exists "users can update own admin preferences" on public.admin_user_preferences;

drop policy if exists "users can read their admin preferences" on public.admin_user_preferences;
create policy "users can read their admin preferences"
on public.admin_user_preferences
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and app_private.is_company_member(company_id)
);

drop policy if exists "users can create their admin preferences" on public.admin_user_preferences;
create policy "users can create their admin preferences"
on public.admin_user_preferences
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and app_private.is_company_member(company_id)
);

drop policy if exists "users can update their admin preferences" on public.admin_user_preferences;
create policy "users can update their admin preferences"
on public.admin_user_preferences
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and app_private.is_company_member(company_id)
)
with check (
  (select auth.uid()) = user_id
  and app_private.is_company_member(company_id)
);
