-- PROPOSED ONLY. Review, then paste the whole script into the Supabase SQL Editor.
-- Reuses existing tables/JSONB columns. No existing creator rows are changed.
-- Requires the existing company foundation, team permissions and creator hub migrations.
begin;

create or replace function app_private.discover_instagram_handle(value text)
returns text language plpgsql immutable set search_path = '' as $$
declare h text := lower(btrim(value));
begin
  if h is null or h = '' then return null; end if;
  if h ~ '^(https?://)?(www\.|m\.)?instagram\.com/' then
    h := regexp_replace(h, '^(https?://)?(www\.|m\.)?instagram\.com/', '');
    h := split_part(split_part(h, '?', 1), '#', 1);
    h := regexp_replace(h, '/$', '');
  else h := regexp_replace(h, '^@', ''); end if;
  if h !~ '^[a-z0-9_]([a-z0-9_.]{0,28}[a-z0-9_])?$' or h like '%..%'
    or h = any(array['p','reel','reels','stories','explore','accounts','direct']) then return null; end if;
  return h;
end $$;
revoke all on function app_private.discover_instagram_handle(text) from public, anon;
grant execute on function app_private.discover_instagram_handle(text) to authenticated;

-- Applies only to import metadata, preserving legacy records with no import identity.
-- If conflicting import identities already exist, index creation aborts this transaction;
-- no automatic deletion, merging or overwrite is attempted.
create unique index if not exists company_creators_discover_instagram_unique
on public.company_creators (company_id, (metadata #>> '{discover,instagram_handle}'))
where metadata #>> '{discover,instagram_handle}' is not null;

-- Existing social read policies require an Auth-linked creator account. Imports have none.
drop policy if exists "members read linked creator socials" on public.creator_social_accounts;
create policy "members read linked creator socials"
on public.creator_social_accounts for select to authenticated
using (exists (select 1 from public.company_creators cc
  where cc.creator_id = creator_social_accounts.creator_id
  and app_private.is_company_member(cc.company_id)));

-- Privileged only because authenticated operators cannot insert creator identity rows.
-- The private function checks the caller and company permission before reading or writing.
create or replace function app_private.import_discover_creator(p_company_id uuid, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f jsonb := p_record->'fields';
  h text;
  k text;
  n numeric;
  v_creator_id uuid;
  v_duplicate uuid;
  v_data jsonb;
begin
  if auth.uid() is null or not app_private.has_company_permission(p_company_id, 'operations.work') then
    raise exception 'Not authorized to import creators' using errcode = '42501';
  end if;
  if jsonb_typeof(p_record) is distinct from 'object' or jsonb_typeof(f) is distinct from 'object'
     or octet_length(p_record::text) > 120000 then raise exception 'Invalid import record'; end if;
  if jsonb_typeof(f->'name') is distinct from 'string' or length(btrim(f->>'name')) not between 1 and 160 then raise exception 'NAME is required'; end if;
  h := app_private.discover_instagram_handle(f->>'instagram');
  if h is null then raise exception 'Valid Instagram profile required'; end if;
  if jsonb_typeof(p_record->'row') is distinct from 'number' or (p_record->>'row') !~ '^[0-9]+$'
    or (p_record->>'row')::integer not between 2 and 501
    or jsonb_typeof(p_record->'filename') is distinct from 'string'
    or length(p_record->>'filename') not between 1 and 255
    or jsonb_typeof(p_record->'sheet') is distinct from 'string'
    or length(p_record->>'sheet') not between 1 and 255
    or jsonb_typeof(p_record->'raw') is distinct from 'array'
    or jsonb_typeof(p_record->'headers') is distinct from 'array' then raise exception 'Import provenance required'; end if;
  if jsonb_array_length(p_record->'raw') > 50 or jsonb_array_length(p_record->'headers') > 50
    or jsonb_array_length(p_record->'raw') <> jsonb_array_length(p_record->'headers') then raise exception 'Invalid source columns'; end if;
  for k in select jsonb_object_keys(f) loop
    if not k = any(array['serial','name','category','instagram','facebook','followers','views','likes','er','gender','audienceAge','countries','cities','story','static','carousel','video','reel','email','contact','age','location','source'])
      or jsonb_typeof(f->k) not in ('null','number','string') or length(f->>k) > 2000 then raise exception 'Invalid field'; end if;
  end loop;
  foreach k in array array['followers','views','likes','er','story','static','carousel','video','reel','age'] loop
    if f->k is not null and f->k <> 'null'::jsonb then
      if jsonb_typeof(f->k) <> 'number' then raise exception '% must be numeric', k; end if;
      n := (f->>k)::numeric;
      if n < 0 or n > 9007199254740991 or (k = 'er' and n > 1)
        or (k in ('followers','age') and trunc(n) <> n) or (k = 'age' and n > 120) then raise exception 'Invalid %', k; end if;
    end if;
  end loop;
  if f->>'facebook' is not null and f->>'facebook' !~* '^https?://(www\.|m\.)?(facebook\.com|fb\.com)(/|$)' then raise exception 'Invalid Facebook URL'; end if;
  if f->>'email' is not null and f->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;

  -- Serializes concurrent imports in a company; each row is an atomic transaction.
  perform pg_advisory_xact_lock(hashtextextended('discover-import:' || p_company_id::text, 0));
  select cc.creator_id into v_duplicate
  from public.company_creators cc join public.creators c on c.id = cc.creator_id
  where cc.company_id = p_company_id and (
    cc.metadata #>> '{discover,instagram_handle}' = h
    or app_private.discover_instagram_handle(c.primary_handle) = h
    or exists (select 1 from public.creator_social_accounts s where s.creator_id = cc.creator_id
      and (app_private.discover_instagram_handle(s.profile_url) = h
        or (lower(s.platform) = 'instagram' and app_private.discover_instagram_handle(s.handle) = h))))
  limit 1;
  if v_duplicate is not null then return jsonb_build_object('status','duplicate','creator_id',v_duplicate); end if;

  v_data := jsonb_build_object('version',1,'fields',f,'instagram_handle',h,
    'raw',p_record->'raw','headers',p_record->'headers','row',p_record->'row',
    'filename',p_record->>'filename','sheet',p_record->>'sheet',
    'imported_at',now(),'imported_by',auth.uid(),'metric_captured_at',null,
    'metric_provenance','spreadsheet_import_unverified','content_value_units','unconfirmed');
  insert into public.creators(display_name,primary_handle) values (btrim(f->>'name'),h) returning id into v_creator_id;
  insert into public.company_creators(company_id,creator_id,status,source,commercial_relationship,metadata)
    values(p_company_id,v_creator_id,'discovered',f->>'source','unconfirmed',jsonb_build_object('discover',v_data));
  insert into public.creator_social_accounts(creator_id,profile_url,platform,handle,is_primary,verification_status)
    values(v_creator_id,'https://www.instagram.com/' || h || '/','instagram',h,true,'imported_unverified');
  if f->>'facebook' is not null then
    insert into public.creator_social_accounts(creator_id,profile_url,platform,verification_status)
      values(v_creator_id,f->>'facebook','facebook','imported_unverified');
  end if;
  return jsonb_build_object('status','imported','creator_id',v_creator_id);
end $$;
revoke all on function app_private.import_discover_creator(uuid,jsonb) from public, anon;
grant execute on function app_private.import_discover_creator(uuid,jsonb) to authenticated;

create or replace function public.import_discover_creator(p_company_id uuid, p_record jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select app_private.import_discover_creator(p_company_id,p_record);
$$;
revoke all on function public.import_discover_creator(uuid,jsonb) from public, anon;
grant execute on function public.import_discover_creator(uuid,jsonb) to authenticated;

create or replace function public.discover_import_ready(p_company_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and app_private.has_company_permission(p_company_id,'operations.work');
$$;
revoke all on function public.discover_import_ready(uuid) from public, anon;
grant execute on function public.discover_import_ready(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
