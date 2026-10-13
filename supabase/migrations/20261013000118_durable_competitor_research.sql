-- Durable competition research. Only trusted server code can create work or reserve paid attempts.
alter table public.brand_competitor_scans
  add column stage text not null default 'complete',
  add column deadline_at timestamptz not null default (now() + interval '30 minutes'),
  add column requests_used integer not null default 0,
  add column cache_hits integer not null default 0,
  add column payload jsonb not null default '{}',
  add column cache_from_scan_id uuid references public.brand_competitor_scans(id),
  add column cache_expires_at timestamptz;
alter table public.brand_competitor_scans drop constraint if exists brand_competitor_scans_provider_key_check;
alter table public.brand_competitor_scans add constraint brand_competitor_scans_provider_key_check check(provider_key in ('serpapi','searchapi'));
alter table public.brand_competitors add column research_summary jsonb not null default '{}', add column research_status text not null default 'pending';
alter table public.brand_competitor_observations drop constraint if exists brand_competitor_observations_evidence_kind_check;
alter table public.brand_competitor_observations add constraint brand_competitor_observations_evidence_kind_check check(evidence_kind in ('discovery','official_site','reddit_excerpt','amazon_product','amazon_review','meta_ad','google_ad','social_post','social_comment','product_price','web_fallback'));
create index brand_research_scans_lookup on public.brand_competitor_scans(company_id,query_hash,created_at desc) where provider_key='searchapi';

create table public.brand_research_control (
  id boolean primary key default true check(id), enabled boolean not null default true,
  daily_search_limit integer not null default 96 check(daily_search_limit between 1 and 100000),
  monthly_search_limit integer not null default 2880 check(monthly_search_limit between 1 and 1000000),
  daily_openai_usd numeric not null default 10 check(daily_openai_usd>0), monthly_openai_usd numeric not null default 100 check(monthly_openai_usd>0),
  account_remaining_credits integer, account_hourly_limit integer, account_searches_this_hour integer,
  account_checked_at timestamptz, next_dispatch_at timestamptz, blocked_until timestamptz,
  worker_heartbeat_at timestamptz, last_error text
);
insert into public.brand_research_control(id) values(true);
create table public.brand_research_tasks (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null, scan_id uuid not null,
  kind text not null check(kind in ('discovery','extract','verify','meta_ads','google_ads','instagram_profile','instagram_comments','products','summarize','fallback','clone')),
  dedupe_key text not null, dependencies uuid[] not null default '{}', payload jsonb not null default '{}', result jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','skipped','uncertain')),
  attempt_count integer not null default 0, next_attempt_at timestamptz not null default now(), deadline_at timestamptz not null,
  lease_token uuid, lease_expires_at timestamptz, worker_id uuid, error_code text,
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
  foreign key(scan_id,company_id,campaign_id) references public.brand_competitor_scans(id,company_id,campaign_id) on delete cascade,
  unique(scan_id,dedupe_key)
);
create index brand_research_task_queue on public.brand_research_tasks(next_attempt_at,created_at) where status='queued';
create index brand_research_task_scan on public.brand_research_tasks(scan_id);
create index brand_research_task_tenant on public.brand_research_tasks(company_id);
create table public.brand_research_attempts (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.brand_research_tasks(id) on delete cascade,
  scan_id uuid not null references public.brand_competitor_scans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade, provider text not null check(provider in ('searchapi','openai')),
  lease_token uuid not null, status text not null default 'started' check(status in ('started','succeeded','failed','uncertain')),
  reserved_cost_usd numeric not null default 0 check(reserved_cost_usd>=0), reserved_input_tokens integer not null default 0 check(reserved_input_tokens>=0), reserved_output_tokens integer not null default 0 check(reserved_output_tokens>=0),
  input_tokens integer, output_tokens integer, request_id text, latency_ms integer, error_code text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create unique index brand_research_one_attempt on public.brand_research_attempts(task_id) where status='started';
create index brand_research_attempt_limits on public.brand_research_attempts(provider,created_at);
create index brand_research_attempt_scan on public.brand_research_attempts(scan_id,provider);
create index brand_research_attempt_company on public.brand_research_attempts(company_id);
create table public.brand_research_cache (
  company_id uuid not null references public.companies(id) on delete cascade, cache_key text not null,
  payload jsonb not null, fetched_at timestamptz not null, expires_at timestamptz not null,
  primary key(company_id,cache_key)
);
create index brand_research_cache_expiry on public.brand_research_cache(expires_at);
create table app_private.research_worker_nonces(nonce_hash text primary key,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
alter table app_private.research_worker_nonces enable row level security;
alter table public.brand_research_control enable row level security;
alter table public.brand_research_tasks enable row level security;
alter table public.brand_research_attempts enable row level security;
alter table public.brand_research_cache enable row level security;
revoke all on public.brand_research_control,public.brand_research_tasks,public.brand_research_attempts,public.brand_research_cache,app_private.research_worker_nonces from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant all on public.brand_research_control,public.brand_research_tasks,public.brand_research_attempts,public.brand_research_cache,app_private.research_worker_nonces to service_role;
grant select(id,company_id,campaign_id,scan_id,kind,status,error_code,next_attempt_at,created_at) on public.brand_research_tasks to authenticated;
create policy "brand reads own research progress" on public.brand_research_tasks for select to authenticated using(app_private.is_brand_member(company_id));

create function public.enqueue_research_scan(target_company_id uuid,target_campaign_id uuid,actor_id uuid,query_hash text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare existing public.brand_competitor_scans%rowtype; source public.brand_competitor_scans%rowtype; state text; scan_id uuid;
begin
  perform 1 from public.companies where id=target_company_id for update;
  if not exists(select 1 from public.brand_memberships where company_id=target_company_id and user_id=actor_id and status='active') then raise exception 'campaign_access'; end if;
  select status into state from public.brand_campaigns where id=target_campaign_id and company_id=target_company_id for update;
  if state is null or state in ('active','completed','archived') then raise exception 'campaign_read_only'; end if;
  if length(query_hash)<>64 or jsonb_typeof(payload)<>'object' then raise exception 'invalid_input'; end if;
  select s.* into existing from public.brand_competitor_scans s where s.campaign_id=target_campaign_id and s.company_id=target_company_id and s.status in ('queued','running') order by s.created_at desc limit 1;
  if found then return jsonb_build_object('scan_id',existing.id,'disposition','running'); end if;
  select s.* into source from public.brand_competitor_scans s where s.company_id=target_company_id and s.query_hash=enqueue_research_scan.query_hash and s.provider_key='searchapi' and s.cache_from_scan_id is null
    and (s.status in ('queued','running') or (s.status='succeeded' and s.cache_expires_at>now())) order by s.created_at desc limit 1;
  if source.id is not null and source.campaign_id=target_campaign_id then return jsonb_build_object('scan_id',source.id,'disposition',case when source.status='succeeded' then 'cached' else 'running' end); end if;
  if source.id is null and (select count(*) from public.brand_competitor_scans s where s.company_id=target_company_id and s.provider_key='searchapi' and s.cache_from_scan_id is null and s.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'scan_daily_limit'; end if;
  insert into public.brand_competitor_scans(company_id,campaign_id,provider_key,query_hash,status,stage,created_by,payload,cache_from_scan_id,cache_expires_at,deadline_at)
    values(target_company_id,target_campaign_id,'searchapi',query_hash,'queued','queued',actor_id,payload,source.id,source.cache_expires_at,now()+interval '30 minutes') returning id into scan_id;
  update public.brand_campaigns set status='scanning',updated_at=now() where id=target_campaign_id;
  return jsonb_build_object('scan_id',scan_id,'disposition',case when source.status='succeeded' then 'cached' else 'created' end);
end; $$;

create function public.recover_research_tasks() returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform 1 from public.brand_research_control where id for update;
  -- Lost responses stay uncertain. Saved checkpoints are safe to replay without another provider call.
  update public.brand_research_attempts a set status='uncertain',error_code='lease_expired',completed_at=now() from public.brand_research_tasks t
    where a.task_id=t.id and a.status='started' and t.status='running' and (t.deadline_at<now() or (t.lease_expires_at<now() and not(t.result?'response' or t.result?'ai_value')));
  update public.brand_research_tasks t set status=case when t.result?'response' or t.result?'ai_value' then 'queued' when exists(select 1 from public.brand_research_attempts a where a.task_id=t.id and a.status='uncertain') then 'uncertain' else 'queued' end,
    error_code=case when t.result?'response' or t.result?'ai_value' then null else 'lease_expired' end,lease_token=null,lease_expires_at=null,next_attempt_at=now()
    where t.status='running' and t.lease_expires_at<now();
  update public.brand_research_tasks set status='failed',error_code='research_deadline',completed_at=now() where status in ('queued','running') and deadline_at<now();
  update public.brand_competitor_scans s set status=case when exists(select 1 from public.brand_competitors c where c.scan_id=s.id) then 'succeeded' else 'failed' end,stage='complete',error_code='research_deadline',completed_at=now(),result_count=(select count(*) from public.brand_competitors c where c.scan_id=s.id)
    where s.provider_key='searchapi' and s.status in ('queued','running') and s.deadline_at<now();
  update public.brand_campaigns c set status='planning',updated_at=now() where c.status='scanning' and exists(select 1 from public.brand_competitor_scans s where s.campaign_id=c.id and s.provider_key='searchapi' and s.error_code='research_deadline') and not exists(select 1 from public.brand_competitor_scans s where s.campaign_id=c.id and s.status in ('queued','running'));
end; $$;
revoke all on function public.recover_research_tasks() from public,anon,authenticated;
grant execute on function public.recover_research_tasks() to service_role;

create function public.claim_research_task(worker_id uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare task public.brand_research_tasks%rowtype;
begin
  perform 1 from public.brand_research_control where id for update;
  perform public.recover_research_tasks();
  select t.* into task from public.brand_research_tasks t join public.brand_competitor_scans s on s.id=t.scan_id join public.brand_campaigns c on c.id=t.campaign_id
    where t.status='queued' and t.next_attempt_at<=now() and t.deadline_at>now() and s.status in ('queued','running') and c.status not in ('active','completed','archived')
    and not exists(select 1 from unnest(t.dependencies) dep left join public.brand_research_tasks d on d.id=dep where d.id is null or d.status in ('queued','running'))
    order by (select max(a.created_at) from public.brand_research_attempts a where a.company_id=t.company_id) asc nulls first,t.created_at,t.id
    for update of t skip locked limit 1;
  if not found then return null; end if;
  update public.brand_research_tasks set status='running',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '120 seconds',worker_id=claim_research_task.worker_id,started_at=coalesce(started_at,now()) where id=task.id returning * into task;
  update public.brand_competitor_scans set status='running',started_at=coalesce(started_at,now()) where id=task.scan_id;
  return to_jsonb(task);
end; $$;

create function public.finish_research_task(task_id uuid,lease uuid,task_status text,task_result jsonb,failure_code text default null,retry_at timestamptz default null) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare task public.brand_research_tasks%rowtype;
begin
  if task_status not in ('queued','succeeded','failed','skipped','uncertain') or jsonb_typeof(task_result)<>'object' then raise exception 'invalid_outcome'; end if;
  select * into task from public.brand_research_tasks where id=task_id and lease_token=lease and status='running' and lease_expires_at>now() for update;
  if not found then raise exception 'research_lease_lost'; end if;
  update public.brand_research_tasks set status=task_status,result=task.result||task_result,error_code=failure_code,next_attempt_at=coalesce(retry_at,now()),completed_at=case when task_status='queued' then null else now() end,lease_expires_at=null where id=task_id;
  if task_status='succeeded' and coalesce((task_result->>'cache_hit')::boolean,false) then update public.brand_competitor_scans set cache_hits=cache_hits+1 where id=task.scan_id; end if;
  return true;
end; $$;

create function public.reserve_research_attempt(task_id uuid,lease uuid,provider text,estimated_usd numeric default 0,input_tokens integer default 0,output_tokens integer default 0) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare ctl public.brand_research_control%rowtype; task public.brand_research_tasks%rowtype; scan public.brand_competitor_scans%rowtype; amount integer; after_check integer; attempt_id uuid; today timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'; month_start timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'; code text;
begin
  select * into ctl from public.brand_research_control where id for update;
  select * into task from public.brand_research_tasks where id=task_id and lease_token=lease and status='running' and lease_expires_at>now() for update;
  if task.id is null then raise exception 'research_lease_lost'; end if;
  select * into scan from public.brand_competitor_scans where id=task.scan_id for update;
  if not ctl.enabled then code:='provider_disabled';
  elsif scan.status not in ('queued','running') or scan.deadline_at<=now() then code:='research_deadline';
  elsif not exists(select 1 from public.brand_campaigns where id=task.campaign_id and company_id=task.company_id and status not in ('active','completed','archived')) then code:='campaign_read_only';
  elsif exists(select 1 from public.brand_research_attempts a where a.task_id=task.id and a.status in ('started','uncertain')) then code:='operation_uncertain';
  elsif task.attempt_count>=2 then code:='task_attempt_limit';
  elsif provider not in ('searchapi','openai') then code:='invalid_provider'; end if;
  if code is not null then return jsonb_build_object('allowed',false,'error',code); end if;
  if provider='searchapi' then
    select count(*) into after_check from public.brand_research_attempts a where a.provider='searchapi' and a.created_at>=ctl.account_checked_at;
    if scan.requests_used>=32 then code:='scan_request_limit';
    elsif ctl.account_checked_at is null or ctl.account_checked_at<now()-interval '10 minutes' then code:='provider_account_stale';
    elsif ctl.account_remaining_credits is null or ctl.account_remaining_credits-after_check<=0 then code:='provider_credit_limit';
    elsif ctl.blocked_until>now() then code:='provider_rate_limited';
    elsif ctl.account_hourly_limit is null or ctl.account_hourly_limit<=ctl.account_searches_this_hour+after_check then code:='provider_hourly_limit';
    elsif (select count(*) from public.brand_research_attempts a where a.provider='searchapi' and a.created_at>=today)>=ctl.daily_search_limit then code:='platform_daily_limit';
    elsif (select count(*) from public.brand_research_attempts a where a.provider='searchapi' and a.created_at>=month_start)>=ctl.monthly_search_limit then code:='platform_monthly_limit';
    elsif (select count(*) from public.brand_research_attempts a where a.provider='searchapi' and a.status='started')>=2 then code:='provider_concurrency';
    elsif ctl.next_dispatch_at>now() then code:='provider_pacing'; end if;
  else
    select count(*) into amount from public.brand_research_attempts a where a.scan_id=scan.id and a.provider='openai';
    if estimated_usd is null or estimated_usd<=0 or input_tokens<0 or output_tokens<0 then code:='cost_estimate_required';
    elsif amount>=4 then code:='scan_openai_limit';
    elsif task.kind='fallback' and (select count(*) from public.brand_research_attempts a join public.brand_research_tasks t on t.id=a.task_id where a.scan_id=scan.id and a.provider='openai' and t.kind='fallback')>=2 then code:='fallback_limit';
    elsif coalesce((select sum(a.reserved_input_tokens) from public.brand_research_attempts a where a.scan_id=scan.id and a.provider='openai'),0)+input_tokens>600000 or coalesce((select sum(a.reserved_output_tokens) from public.brand_research_attempts a where a.scan_id=scan.id and a.provider='openai'),0)+output_tokens>12000 then code:='scan_token_limit';
    elsif coalesce((select sum(a.reserved_cost_usd) from public.brand_research_attempts a where a.provider='openai' and a.created_at>=today),0)+estimated_usd>ctl.daily_openai_usd then code:='platform_daily_budget';
    elsif coalesce((select sum(a.reserved_cost_usd) from public.brand_research_attempts a where a.provider='openai' and a.created_at>=month_start),0)+estimated_usd>ctl.monthly_openai_usd then code:='platform_monthly_budget';
    elsif (select count(*) from public.brand_research_attempts a where a.provider='openai' and a.status='started')>=2 then code:='provider_concurrency'; end if;
  end if;
  if code is not null then return jsonb_build_object('allowed',false,'error',code,'retry_after',case when code='provider_pacing' then greatest(1,ceil(extract(epoch from ctl.next_dispatch_at-now()))) when code='provider_rate_limited' then greatest(1,ceil(extract(epoch from ctl.blocked_until-now()))) else 60 end); end if;
  insert into public.brand_research_attempts(task_id,scan_id,company_id,provider,lease_token,reserved_cost_usd,reserved_input_tokens,reserved_output_tokens)
    values(task.id,scan.id,task.company_id,provider,lease,estimated_usd,input_tokens,output_tokens) returning id into attempt_id;
  update public.brand_research_tasks set attempt_count=attempt_count+1 where id=task.id;
  if provider='searchapi' then
    update public.brand_competitor_scans set requests_used=requests_used+1 where id=scan.id;
    -- Pacing uses the real account allowance; concurrency remains a separate two-call ceiling.
    update public.brand_research_control set next_dispatch_at=now()+make_interval(secs=>greatest(1.0,3600.0/greatest(1,ctl.account_hourly_limit))) where id;
  end if;
  return jsonb_build_object('allowed',true,'attempt_id',attempt_id);
end; $$;

create function public.finish_research_attempt(attempt_id uuid,lease uuid,outcome jsonb) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare attempt public.brand_research_attempts%rowtype; task public.brand_research_tasks%rowtype; result_status text;
begin
  perform 1 from public.brand_research_control where id for update;
  select * into attempt from public.brand_research_attempts where id=attempt_id for update;
  if not found then raise exception 'attempt_missing'; end if;
  select * into task from public.brand_research_tasks where id=attempt.task_id and lease_token=lease and status='running' and lease_expires_at>now();
  if task.id is null then raise exception 'research_lease_lost'; end if;
  if attempt.status='succeeded' then return true; end if;
  result_status:=case when outcome->>'status'='success' then 'succeeded' else outcome->>'status' end;
  if result_status not in ('succeeded','failed','uncertain') then raise exception 'invalid_outcome'; end if;
  if attempt.status='uncertain' and not(task.result?'response' or task.result?'ai_value') then raise exception 'outcome_uncertain'; end if;
  update public.brand_research_attempts set status=result_status,completed_at=now(),request_id=left(outcome->>'request_id',150),error_code=left(outcome->>'failure_code',100),latency_ms=coalesce((outcome->>'latency_ms')::integer,latency_ms),input_tokens=(outcome->>'input_tokens')::integer,output_tokens=(outcome->>'output_tokens')::integer where id=attempt_id;
  if outcome->>'failure_code'='provider_rate_limited' and attempt.provider='searchapi' then update public.brand_research_control set blocked_until=greatest(coalesce(blocked_until,now()),now()+make_interval(secs=>least(86400,greatest(1,coalesce((outcome->>'retry_after')::integer,60))))) where id; end if;
  return true;
end; $$;

create function public.update_research_account(account_info jsonb) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if (account_info->>'remainingCredits')::integer<0 or (account_info->>'hourlyRateLimit')::integer<0 or (account_info->>'searchesThisHour')::integer<0 then raise exception 'invalid_account'; end if;
  update public.brand_research_control set account_remaining_credits=(account_info->>'remainingCredits')::integer,account_hourly_limit=(account_info->>'hourlyRateLimit')::integer,account_searches_this_hour=(account_info->>'searchesThisHour')::integer,account_checked_at=now(),last_error=null where id;
  return true;
end; $$;

create function public.select_research_competitors(target_company_id uuid,target_campaign_id uuid,actor_id uuid,target_scan_id uuid,selected_ids uuid[]) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare state text;
begin
  if not exists(select 1 from public.brand_memberships where company_id=target_company_id and user_id=actor_id and status='active') then raise exception 'campaign_access'; end if;
  select status into state from public.brand_campaigns where id=target_campaign_id and company_id=target_company_id for update;
  if state is null or state in ('active','completed','archived') then raise exception 'campaign_read_only'; end if;
  if cardinality(selected_ids) not between 1 and 5 or cardinality(selected_ids)<>(select count(distinct id) from unnest(selected_ids) id) then raise exception 'selection_invalid'; end if;
  if not exists(select 1 from public.brand_competitor_scans where id=target_scan_id and company_id=target_company_id and campaign_id=target_campaign_id and status='succeeded') or exists(select 1 from public.brand_competitor_scans where company_id=target_company_id and campaign_id=target_campaign_id and status in ('queued','running')) then raise exception 'selection_invalid'; end if;
  if (select count(*) from public.brand_competitors where scan_id=target_scan_id and company_id=target_company_id and campaign_id=target_campaign_id and id=any(selected_ids))<>cardinality(selected_ids) then raise exception 'selection_invalid'; end if;
  update public.brand_competitors set status='candidate',confirmed_at=null,updated_at=now() where company_id=target_company_id and campaign_id=target_campaign_id and status='confirmed';
  update public.brand_competitors set status='confirmed',confirmed_at=now(),updated_at=now() where id=any(selected_ids) and scan_id=target_scan_id and company_id=target_company_id;
  return true;
end; $$;

create function public.consume_research_worker_nonce(nonce text) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public,app_private as $$
declare used text;
begin
  if nonce is null or nonce!~'^[0-9a-f]{64}$' then return false; end if;
  update app_private.research_worker_nonces set used_at=now() where nonce_hash=encode(sha256(convert_to(nonce,'UTF8')),'hex') and expires_at>now() and used_at is null returning nonce_hash into used;
  return used is not null;
end; $$;

revoke all on function public.enqueue_research_scan(uuid,uuid,uuid,text,jsonb),public.claim_research_task(uuid),public.finish_research_task(uuid,uuid,text,jsonb,text,timestamptz),public.reserve_research_attempt(uuid,uuid,text,numeric,integer,integer),public.finish_research_attempt(uuid,uuid,jsonb),public.update_research_account(jsonb),public.select_research_competitors(uuid,uuid,uuid,uuid,uuid[]),public.consume_research_worker_nonce(text) from public,anon,authenticated;
grant execute on function public.enqueue_research_scan(uuid,uuid,uuid,text,jsonb),public.claim_research_task(uuid),public.finish_research_task(uuid,uuid,text,jsonb,text,timestamptz),public.reserve_research_attempt(uuid,uuid,text,numeric,integer,integer),public.finish_research_attempt(uuid,uuid,jsonb),public.update_research_account(jsonb),public.select_research_competitors(uuid,uuid,uuid,uuid,uuid[]),public.consume_research_worker_nonce(text) to service_role;

-- Extend the existing audited brief RPC to accept actual retrieved social comments as evidence.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.save_brand_campaign_brief(uuid,integer,jsonb,boolean,text)'::regprocedure) into definition;
  definition:=replace(definition,'''reddit_excerpt'',''amazon_review''','''reddit_excerpt'',''amazon_review'',''social_comment''');
  execute definition;
end; $$;
