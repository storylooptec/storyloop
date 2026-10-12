-- Only the trusted application server writes API telemetry or provider observations.
revoke insert,update,delete on public.external_api_usage_events from authenticated,anon;
revoke insert,update,delete on public.brand_competitor_scans from authenticated,anon;
revoke insert,update,delete on public.brand_competitor_observations from authenticated,anon;
drop policy "brand and Storyloop users append API usage events" on public.external_api_usage_events;
alter table public.external_api_usage_events drop constraint external_api_usage_events_status_check;
alter table public.external_api_usage_events add constraint external_api_usage_events_status_check
  check(status in ('started','success','failed','rate_limited','cached','unknown'));
alter table public.external_api_usage_events
  add column provider_request_id text,
  add column billing_reference text,
  add column reconciled_at timestamptz,
  add column idempotency_key text,
  add column completed_at timestamptz,
  add column reserved_cost_usd numeric(12,6) check(reserved_cost_usd >= 0),
  add constraint api_costs_nonnegative check ((estimated_cost_usd is null or estimated_cost_usd >= 0) and (billed_cost_usd is null or billed_cost_usd >= 0));
create unique index api_usage_dedupe_idx on public.external_api_usage_events(company_id,campaign_id,provider_key,operation,idempotency_key);
create index api_usage_active_idx on public.external_api_usage_events(campaign_id,provider_key,created_at) where status='started';
create table public.api_provider_policies (
  provider_key text primary key check(provider_key in ('serpapi','openai','higgsfield')),
  enabled boolean not null default true,
  daily_company_limit integer not null check(daily_company_limit between 1 and 10000),
  hourly_campaign_limit integer not null check(hourly_campaign_limit between 1 and 1000),
  daily_budget_usd numeric(12,6) check(daily_budget_usd > 0),
  consecutive_failures integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.api_provider_policies(provider_key,daily_company_limit,hourly_campaign_limit)
values ('serpapi',30,30),('openai',100,5),('higgsfield',2,60);
alter table public.api_provider_policies enable row level security;
revoke all on public.api_provider_policies from anon,authenticated;
grant select on public.api_provider_policies to authenticated;
create policy "operators read provider policies" on public.api_provider_policies for select to authenticated
using(app_private.is_storyloop_operator('operations.work'));

create or replace function public.begin_provider_operation(target_company_id uuid,target_campaign_id uuid,
  actor_id uuid,provider text,operation_name text,model_name text,dedupe_key text,reserved_cost numeric)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare p public.api_provider_policies; event uuid; reason text; prior text; is_chargeable boolean;
begin
  if not exists(select 1 from public.brand_memberships where company_id=target_company_id and user_id=actor_id and status='active')
     or not exists(select 1 from public.brand_campaigns where id=target_campaign_id and company_id=target_company_id) then
    return jsonb_build_object('allowed',false,'error','access_denied');
  end if;
  -- Serialize reservations globally per provider, including daily spend and concurrent calls.
  select * into p from public.api_provider_policies where provider_key=provider for update;
  if not found then return jsonb_build_object('allowed',false,'error','unknown_provider'); end if;
  select status into prior from public.external_api_usage_events where company_id=target_company_id
    and campaign_id=target_campaign_id and provider_key=provider and operation=operation_name and idempotency_key=dedupe_key;
  if found then return jsonb_build_object('allowed',false,'error','duplicate_operation'); end if;
  update public.external_api_usage_events set status='unknown',failure_code='worker_interrupted',completed_at=now()
    where provider_key=provider and status='started' and created_at < now()-interval '5 minutes';
  is_chargeable := provider <> 'higgsfield' or operation_name='submit_preview';
  if not p.enabled then reason:='provider_disabled';
  elsif p.blocked_until > now() then reason:='provider_circuit_open';
  elsif exists(select 1 from public.external_api_usage_events where campaign_id=target_campaign_id
    and provider_key=provider and status='started') then reason:='operation_running';
  elsif (select count(*) from public.external_api_usage_events where company_id=target_company_id
    and provider_key=provider and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
    and (provider <> 'higgsfield' or operation='submit_preview') and status not in ('cached','rate_limited')) >= p.daily_company_limit
    and is_chargeable then reason:='app_daily_limit';
  elsif (select count(*) from public.external_api_usage_events where campaign_id=target_campaign_id
    and provider_key=provider and created_at >= date_trunc('hour',now()) and status not in ('cached','rate_limited')) >= p.hourly_campaign_limit
    then reason:='app_hourly_limit';
  elsif p.daily_budget_usd is not null and is_chargeable and reserved_cost is null then reason:='cost_estimate_required';
  elsif p.daily_budget_usd is not null and is_chargeable and exists (select 1 from public.external_api_usage_events
    where company_id=target_company_id and provider_key=provider and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
    and status not in ('rate_limited','cached') and coalesce(billed_cost_usd,estimated_cost_usd,reserved_cost_usd) is null) then reason:='unreconciled_costs';
  elsif p.daily_budget_usd is not null and is_chargeable and (
    select coalesce(sum(coalesce(billed_cost_usd,estimated_cost_usd,reserved_cost_usd,0)),0) from public.external_api_usage_events
    where provider_key=provider and company_id=target_company_id and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
      and status not in ('rate_limited','cached')) + coalesce(reserved_cost,0) > p.daily_budget_usd then reason:='daily_spend_limit';
  end if;
  insert into public.external_api_usage_events(company_id,campaign_id,actor_user_id,provider_key,operation,model,
      status,idempotency_key,reserved_cost_usd,failure_code,completed_at)
  values(target_company_id,target_campaign_id,actor_id,provider,operation_name,model_name,
      case when reason is null then 'started' else 'rate_limited' end,dedupe_key,reserved_cost,reason,
      case when reason is null then null else now() end) returning id into event;
  return jsonb_build_object('allowed',reason is null,'event_id',event,'error',reason);
end; $$;

create or replace function public.finish_provider_operation(event_id uuid,outcome jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare event public.external_api_usage_events; next_status text:=outcome->>'status';
begin
  select * into event from public.external_api_usage_events where id=event_id;
  if not found then return; end if;
  perform 1 from public.api_provider_policies where provider_key=event.provider_key for update;
  select * into event from public.external_api_usage_events where id=event_id for update;
  if not found or event.status <> 'started' then return; end if;
  if next_status not in ('success','failed','rate_limited','cached','unknown') then raise exception 'invalid_status'; end if;
  update public.external_api_usage_events set status=next_status,completed_at=now(),
    latency_ms=(outcome->>'latency_ms')::integer,retry_count=least(2,greatest(0,coalesce((outcome->>'retry_count')::integer,0))),
    input_units=(outcome->>'input_units')::integer,output_units=(outcome->>'output_units')::integer,
    unit_type=outcome->>'unit_type',estimated_cost_usd=coalesce((outcome->>'estimated_cost_usd')::numeric,reserved_cost_usd),
    cache_hit=coalesce((outcome->>'cache_hit')::boolean,false),provider_request_id=outcome->>'provider_request_id',
    failure_code=outcome->>'failure_code' where id=event_id;
  if next_status in ('success','cached') then
    update public.api_provider_policies set consecutive_failures=0,updated_at=now() where provider_key=event.provider_key;
  elsif next_status='rate_limited' then
    update public.api_provider_policies set blocked_until=now()+make_interval(secs=>least(3600,greatest(1,coalesce((outcome->>'retry_after')::int,60)))),updated_at=now()
      where provider_key=event.provider_key;
  elsif next_status in ('failed','unknown') then
    update public.api_provider_policies set consecutive_failures=consecutive_failures+1,
      blocked_until=case when consecutive_failures+1>=5 then now()+interval '5 minutes' else blocked_until end,updated_at=now()
      where provider_key=event.provider_key;
  end if;
end; $$;
revoke all on function public.begin_provider_operation(uuid,uuid,uuid,text,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.finish_provider_operation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_provider_operation(uuid,uuid,uuid,text,text,text,text,numeric) to service_role;
grant execute on function public.finish_provider_operation(uuid,jsonb) to service_role;
grant all on public.external_api_usage_events,public.api_provider_policies,public.brand_campaigns,
 public.brand_competitor_scans,public.brand_competitor_observations,public.brand_memberships to service_role;

-- Make tenant consistency a database constraint as well as an application condition.
alter table public.brand_campaigns add constraint brand_campaigns_id_company_key unique(id,company_id);
alter table public.brand_competitor_scans add constraint scans_campaign_company_fk foreign key(campaign_id,company_id)
  references public.brand_campaigns(id,company_id) on delete cascade;
alter table public.brand_competitor_scans add constraint scans_id_company_key unique(id,company_id);
alter table public.brand_competitor_observations add constraint observations_scan_company_fk foreign key(scan_id,company_id)
  references public.brand_competitor_scans(id,company_id) on delete cascade;
alter table public.brand_campaign_plans add constraint plans_campaign_company_fk foreign key(campaign_id,company_id)
  references public.brand_campaigns(id,company_id) on delete cascade;
alter table public.brand_campaign_creatives add constraint creatives_campaign_company_fk foreign key(campaign_id,company_id)
  references public.brand_campaigns(id,company_id) on delete cascade;
