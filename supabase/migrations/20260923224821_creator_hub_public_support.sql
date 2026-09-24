create unique index if not exists company_creators_company_creator_unique
on public.company_creators (company_id, creator_id);

grant select on public.company_brand_settings to anon, authenticated;

drop policy if exists "public can read Storyloop brand settings" on public.company_brand_settings;
create policy "public can read Storyloop brand settings"
on public.company_brand_settings
for select to anon, authenticated
using (
  company_id = (
    select id from public.companies
    where slug = 'storyloop' and status = 'active'
    limit 1
  )
);

create or replace function public.get_creator_configuration()
returns table (key text, label text, value jsonb, is_tbd boolean)
language sql stable security definer set search_path = public as $$
  select cc.key, cc.label, cc.value, cc.is_tbd
  from public.company_configuration cc
  join public.companies c on c.id = cc.company_id
  where c.slug = 'storyloop'
    and (cc.category = 'creator' or cc.key in ('creator_paid_price','studio_credit_allowance'))
  order by cc.key;
$$;

revoke all on function public.get_creator_configuration() from public;
grant execute on function public.get_creator_configuration() to anon, authenticated;
