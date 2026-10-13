-- Run after 20261013000118_durable_competitor_research.sql.
-- Credentials stay in the existing application environment; no API key is copied here.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function app_private.dispatch_competition_research() returns void
language plpgsql security invoker set search_path=pg_catalog,public,app_private as $$
declare capability text;
begin
  perform public.recover_research_tasks();
  delete from app_private.research_worker_nonces where expires_at<now()-interval '1 day';
  delete from public.brand_research_cache where expires_at<now()-interval '1 day';
  if not exists(select 1 from public.brand_competitor_scans where provider_key='searchapi' and status in ('queued','running')) then return; end if;
  if not exists(select 1 from public.brand_research_control where id and enabled) then return; end if;
  -- Avoid overlapping dispatches. Paid calls also have a separate database concurrency gate.
  if exists(select 1 from app_private.research_worker_nonces where created_at>now()-interval '55 seconds') then return; end if;
  capability:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into app_private.research_worker_nonces(nonce_hash,expires_at)
    values(encode(sha256(convert_to(capability,'UTF8')),'hex'),now()+interval '2 minutes');
  perform net.http_post(
    url:='https://storyloop-six.vercel.app/api/internal/competition-worker',
    body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||capability),
    timeout_milliseconds:=60000
  );
end; $$;
revoke all on function app_private.dispatch_competition_research() from public,anon,authenticated,service_role;
select cron.schedule('storyloop-competition-research','* * * * *','select app_private.dispatch_competition_research();');
