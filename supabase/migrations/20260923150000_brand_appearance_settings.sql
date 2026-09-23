create table public.company_brand_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  default_theme text not null default 'dark'
    check (default_theme in ('dark', 'light')),
  dark_colors jsonb not null,
  light_colors jsonb not null,
  gradient jsonb not null,
  typography jsonb not null,
  radius jsonb not null default '{"sm": null, "md": null, "lg": null}'::jsonb,
  spacing integer[] not null default array[4,8,12,16,20,24,32,40,48,64],
  primary_logo_key text,
  dark_logo_key text,
  light_logo_key text,
  favicon_key text,
  updated_at timestamptz not null default now()
);

alter table public.company_brand_settings enable row level security;

grant select, update on public.company_brand_settings to authenticated;

create policy "members can read brand settings"
on public.company_brand_settings
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "senior approvers can update brand settings"
on public.company_brand_settings
for update
to authenticated
using (app_private.has_company_permission(company_id, 'approvals.perform'))
with check (app_private.has_company_permission(company_id, 'approvals.perform'));

insert into public.company_brand_settings (
  company_id,
  default_theme,
  dark_colors,
  light_colors,
  gradient,
  typography,
  radius,
  spacing
)
select
  c.id,
  'dark',
  '{"canvas":"#0D0D1A","surface":"#13131F","raised":"#191926","line":"#22223A","ink":"#FFFFFF","body":"#C4C4D2","slate":"#888899","dim":"#5C5C6E","accent":"#E040C8","ok":"#3ECF8E","edge":"#6E6E85"}'::jsonb,
  '{"canvas":"#F7F7FB","surface":"#FFFFFF","raised":"#F1F1F6","line":"#E3E3EC","ink":"#14142B","body":"#3C3C50","slate":"#6E6E85","dim":"#9797AB","accent":"#E040C8","edge":"#9A9AAE"}'::jsonb,
  '{"angle":135,"start":"#FF6B6B","middle":"#E040C8","end":"#7B3FF5"}'::jsonb,
  '{"displayFamily":"Montserrat","bodyFamily":"Montserrat","systemFamily":"Exo 2","displayWeight":800,"titleWeight":700,"bodyWeight":400,"systemWeight":700,"systemLetterSpacing":"0.1em"}'::jsonb,
  '{"sm":null,"md":null,"lg":null}'::jsonb,
  array[4,8,12,16,20,24,32,40,48,64]
from public.companies c
where c.slug = 'storyloop'
on conflict (company_id) do nothing;
