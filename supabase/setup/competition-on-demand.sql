-- OpenAI discovery, followed by an explicit, idempotent Get for each competitor.
-- Existing saved reports and legacy tasks remain readable.
alter table public.brand_research_tasks drop constraint if exists brand_research_tasks_kind_check;
alter table public.brand_research_tasks add constraint brand_research_tasks_kind_check check(kind in (
'discovery','extract','verify','meta_ads','google_ads','instagram_profile','instagram_comments','products','summarize','fallback','clone',
'native_discovery','detail_products','detail_page_lookup','detail_facebook','detail_reviews','detail_meta','detail_linkedin','detail_reddit'));
alter table public.brand_competitor_observations drop constraint if exists brand_competitor_observations_evidence_kind_check;
alter table public.brand_competitor_observations add constraint brand_competitor_observations_evidence_kind_check check(evidence_kind in (
'discovery','official_site','reddit_excerpt','amazon_product','amazon_review','meta_ad','google_ad','social_post','social_comment','product_price','web_fallback',
'social_profile','facebook_review','linkedin_ad','reddit_ad'));

create or replace function public.enqueue_competitor_details(target_company_id uuid,target_campaign_id uuid,actor_id uuid,target_scan_id uuid,target_competitor_id uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare scan public.brand_competitor_scans%rowtype; competitor public.brand_competitors%rowtype; state text; deadline timestamptz; item record;
begin
  perform 1 from public.companies where id=target_company_id for update;
  if not exists(select 1 from public.brand_memberships where company_id=target_company_id and user_id=actor_id and status='active') then raise exception 'campaign_access'; end if;
  select status into state from public.brand_campaigns where id=target_campaign_id and company_id=target_company_id for update;
  if state is null or state in ('active','completed','archived') then raise exception 'campaign_read_only'; end if;
  select * into scan from public.brand_competitor_scans where id=target_scan_id and campaign_id=target_campaign_id and company_id=target_company_id for update;
  if scan.id is null or scan.payload->>'flow' is distinct from 'on_demand_v2' then raise exception 'selection_invalid'; end if;
  select * into competitor from public.brand_competitors where id=target_competitor_id and scan_id=scan.id and company_id=target_company_id for update;
  if competitor.id is null or competitor.verified_at is null then raise exception 'selection_invalid'; end if;
  if competitor.research_status <> 'not_fetched' or exists(select 1 from public.brand_research_tasks where scan_id=scan.id and dedupe_key='detail_products:'||competitor.id::text) then
    return jsonb_build_object('disposition','existing','competitor_id',competitor.id);
  end if;
  if scan.cache_expires_at is null or scan.cache_expires_at<=now() then raise exception 'discovery_expired'; end if;
  if exists(select 1 from public.brand_competitor_scans where campaign_id=target_campaign_id and id<>scan.id and status in ('queued','running')) then raise exception 'scan_running'; end if;
  if exists(select 1 from public.brand_research_tasks where scan_id=scan.id and kind in ('native_discovery','clone') and status in ('queued','running')) then raise exception 'scan_running'; end if;
  deadline:=now()+interval '10 minutes';
  update public.brand_competitor_scans set status='running',stage='evidence',completed_at=null,error_code=null,deadline_at=deadline where id=scan.id;
  update public.brand_competitors set research_status='loading' where id=competitor.id;
  for item in select * from (values
    ('detail_products',jsonb_build_object('engine','google','q','site:'||competitor.official_domain||' '||competitor.name||' products services prices fees India')),
    ('detail_linkedin',jsonb_build_object('engine','linkedin_ad_library','advertiser',competitor.name,'country','IN')),
    ('detail_reddit',jsonb_build_object('engine','reddit_ad_library','q',competitor.name))
  ) as planned(kind,params) loop
    insert into public.brand_research_tasks(company_id,campaign_id,scan_id,kind,dedupe_key,payload,deadline_at)
      values(target_company_id,target_campaign_id,scan.id,item.kind,item.kind||':'||competitor.id::text,jsonb_build_object('competitor_id',competitor.id,'params',item.params),deadline)
      on conflict(scan_id,dedupe_key) do nothing;
  end loop;
  return jsonb_build_object('disposition','created','competitor_id',competitor.id,'max_requests',7);
end; $$;

create or replace function public.complete_on_demand_research(target_scan_id uuid) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare scan public.brand_competitor_scans%rowtype; total integer; failure text;
begin
  select * into scan from public.brand_competitor_scans where id=target_scan_id;
  if scan.id is null or scan.payload->>'flow' is distinct from 'on_demand_v2' then return false; end if;
  perform 1 from public.companies where id=scan.company_id for update;
  perform 1 from public.brand_campaigns where id=scan.campaign_id for update;
  select * into scan from public.brand_competitor_scans where id=target_scan_id for update;
  if scan.status not in ('queued','running') or exists(select 1 from public.brand_research_tasks where scan_id=scan.id and status in ('queued','running')) then return false; end if;
  select count(*) into total from public.brand_competitors where scan_id=scan.id;
  if total=0 then
    select coalesce(error_code,'no_verified_competitors') into failure from public.brand_research_tasks where scan_id=scan.id and kind='native_discovery' limit 1;
    failure:=coalesce(failure,'no_verified_competitors');
  end if;
  update public.brand_competitor_scans set status=case when total=0 then 'failed' else 'succeeded' end,stage='complete',result_count=total,error_code=failure,completed_at=now(),cache_expires_at=coalesce(cache_expires_at,now()+interval '24 hours') where id=scan.id;
  update public.brand_campaigns set status='planning',updated_at=now() where id=scan.campaign_id and status in ('draft','scanning','planning');
  return true;
end; $$;
revoke all on function public.enqueue_competitor_details(uuid,uuid,uuid,uuid,uuid),public.complete_on_demand_research(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_competitor_details(uuid,uuid,uuid,uuid,uuid),public.complete_on_demand_research(uuid) to service_role;

create or replace function public.reserve_research_attempt(task_id uuid,lease uuid,provider text,estimated_usd numeric default 0,input_tokens integer default 0,output_tokens integer default 0) returns jsonb
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
  elsif task.attempt_count>=(case when scan.payload->>'flow'='on_demand_v2' then 1 else 2 end) then code:='task_attempt_limit';
  elsif provider not in ('searchapi','openai') then code:='invalid_provider'; end if;
  if code is not null then return jsonb_build_object('allowed',false,'error',code); end if;
  if provider='searchapi' then
    select count(*) into after_check from public.brand_research_attempts a where a.provider='searchapi' and a.created_at>=ctl.account_checked_at;
    if scan.payload->>'flow'='on_demand_v2' and (task.kind not like 'detail_%' or not exists(select 1 from public.brand_competitors c where c.id::text=task.payload->>'competitor_id' and c.scan_id=scan.id and c.research_status='loading')) then code:='details_not_requested';
    elsif scan.payload->>'flow'='on_demand_v2' and (select count(*) from public.brand_research_attempts a join public.brand_research_tasks t on t.id=a.task_id where a.scan_id=scan.id and a.provider='searchapi' and t.payload->>'competitor_id'=task.payload->>'competitor_id')>=7 then code:='competitor_request_limit';
    elsif scan.requests_used>=(case when scan.payload->>'flow'='on_demand_v2' then 35 else 32 end) then code:='scan_request_limit';
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
    elsif amount>=(case when scan.payload->>'flow'='on_demand_v2' then 1 else 4 end) then code:='scan_openai_limit';
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


create or replace function public.recover_research_tasks() returns void
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
  update public.brand_competitors c set research_status='partial',enriched_at=now(),research_summary=c.research_summary||jsonb_build_object('product_price',coalesce(nullif(c.research_summary->>'product_price','Fetching…'),'Unavailable from retrieved sources'),'campaign',coalesce(nullif(c.research_summary->>'campaign','Fetching…'),'Unavailable from retrieved sources'),'social',coalesce(nullif(c.research_summary->>'social','Fetching…'),'Unavailable from retrieved sources'),'sentiment',coalesce(nullif(c.research_summary->>'sentiment','Fetching…'),'Unavailable from retrieved sources'),'detail_errors',jsonb_build_array(jsonb_build_object('code','research_deadline')))
    from public.brand_competitor_scans s where c.scan_id=s.id and s.payload->>'flow'='on_demand_v2' and c.research_status='loading' and s.status in ('succeeded','failed') and s.error_code='research_deadline';
end; $$;
