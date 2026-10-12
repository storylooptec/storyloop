-- One self-service workspace per verified account; no domain-based automatic membership.
create or replace function public.create_brand_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare actor uuid:=auth.uid(); company uuid;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'verified_email_required';
  end if;
  if length(trim(workspace_name)) not between 2 and 120 then raise exception 'invalid_workspace_name'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,4));
  select company_id into company from public.brand_memberships where user_id=actor and status='active' order by created_at limit 1;
  if company is not null then return company; end if;
  if exists(select 1 from public.brand_memberships where user_id=actor) then raise exception 'workspace_inactive'; end if;
  company:=gen_random_uuid();
  insert into public.companies(id,name,slug) values(company,trim(workspace_name),'brand-'||company::text);
  insert into public.brand_memberships(company_id,user_id,role,status) values(company,actor,'owner','active');
  return company;
end; $$;
revoke all on function public.create_brand_workspace(text) from public,anon;
grant execute on function public.create_brand_workspace(text) to authenticated;
