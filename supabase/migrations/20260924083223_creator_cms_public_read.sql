grant select on public.creator_cms_content to anon;

create policy "public reads active Storyloop creator cms"
on public.creator_cms_content
for select
to anon
using (
  is_active
  and company_id = (
    select id from public.companies
    where slug='storyloop' and status='active'
    limit 1
  )
);
