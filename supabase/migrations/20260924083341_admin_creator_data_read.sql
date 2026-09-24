create policy "company members read creator accounts"
on public.creator_accounts
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "company members read creator socials"
on public.creator_social_accounts
for select
to authenticated
using (
  exists (
    select 1 from public.creator_accounts ca
    where ca.creator_id = creator_social_accounts.creator_id
      and app_private.is_company_member(ca.company_id)
  )
);

create policy "company members read creator studio"
on public.creator_studio_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.creator_accounts ca
    where ca.creator_id = creator_studio_profiles.creator_id
      and app_private.is_company_member(ca.company_id)
  )
);

create policy "company members read creator usage"
on public.creator_create_usage
for select
to authenticated
using (
  exists (
    select 1 from public.creator_accounts ca
    where ca.creator_id = creator_create_usage.creator_id
      and app_private.is_company_member(ca.company_id)
  )
);
