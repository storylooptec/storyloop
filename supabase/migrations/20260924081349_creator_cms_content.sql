create table public.creator_cms_content (
  company_id uuid not null references public.companies(id) on delete cascade,
  content_key text not null,
  section text not null,
  label text not null,
  value text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (company_id, content_key)
);

alter table public.creator_cms_content enable row level security;
grant select, insert, update on public.creator_cms_content to authenticated;

create policy "company members can read creator cms"
on public.creator_cms_content for select to authenticated
using (app_private.is_company_member(company_id));

create policy "senior members can insert creator cms"
on public.creator_cms_content for insert to authenticated
with check (app_private.has_company_permission(company_id, 'approvals.perform'));

create policy "senior members can update creator cms"
on public.creator_cms_content for update to authenticated
using (app_private.has_company_permission(company_id, 'approvals.perform'))
with check (app_private.has_company_permission(company_id, 'approvals.perform'));
