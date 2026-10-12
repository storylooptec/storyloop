import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL execution in WASM. No production database, network or provider calls.
const db = new PGlite();
const root = fileURLToPath(new URL("../", import.meta.url));
const id = Object.fromEntries(["companyA", "companyB", "userA", "userB", "operator", "creatorUser", "creator", "campaignA", "campaignB", "scanA", "scanB", "competitorA", "competitorB", "evidenceA", "evidenceB", "catalog", "rate"].map((key) => [key, randomUUID()]));
let storyloopId;
const brief = (evidence = id.evidenceA) => ({ summary: "An evidence-backed campaign", pain_areas: [{ id: "pain-1", statement: "An observed customer concern", evidence_ids: [evidence] }], usp_hypotheses: [], recommended_angle: "Explain the product clearly", creator_brief: "Demonstrate actual usage", must_include: ["Brand name"], must_avoid: ["Unsupported promises"] });
const concepts = { concepts: Array.from({ length: 3 }, (_, index) => ({ angle: `Angle ${index + 1}`, hook: "A clear opening hook", script: "A product demonstration with a simple explanation.", cta: "Learn more", format: "instagram_reel" })) };
const q = (sql, params = []) => db.query(sql, params);
const one = async (sql, params = []) => (await q(sql, params)).rows[0];
async function role(name, user = "") {
  assert.ok(["authenticated", "anon", "service_role", "postgres"].includes(name));
  await db.exec("reset role");
  await db.exec(`set local role ${name}`);
  await q("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [user, JSON.stringify({ sub: user, role: name })]);
}
async function fails(sql, params = [], pattern = /permission denied|row-level security|not authorized|access|invalid|require|unavailable|changed|cannot|read-only|read_only|no_plan|revision|citations|date|foreign key|constraint/i) {
  await db.exec("savepoint expected_failure");
  try { await assert.rejects(q(sql, params), pattern); }
  finally { await db.exec("rollback to savepoint expected_failure; release savepoint expected_failure"); }
}
function scenario(name, work) {
  test(name, async () => {
    await db.exec("begin");
    try { await work(); }
    finally { await db.exec("rollback"); }
  });
}
async function saveBrief({ campaign = id.campaignA, revision = 0, content = brief(), approve = false } = {}) {
  return (await one("select public.save_brand_campaign_brief($1,$2,$3::jsonb,$4,null) as revision", [campaign, revision, JSON.stringify(content), approve])).revision;
}
async function approvedPlan() {
  await role("authenticated", id.userA);
  const revision = await saveBrief();
  return saveBrief({ revision, approve: true });
}
async function approvedCreative() {
  const revision = await approvedPlan();
  await role("service_role");
  const creative = (await one("insert into brand_campaign_creatives(campaign_id,company_id,content,plan_revision) values($1,$2,$3::jsonb,$4) returning id", [id.campaignA, id.companyA, JSON.stringify(concepts), revision])).id;
  await role("authenticated", id.userA);
  await q("select approve_brand_creative($1,1)", [creative]);
  return { creative, planRevision: revision };
}
async function launch() {
  const result = await approvedCreative();
  await q("select transition_brand_campaign($1,'active',date_trunc('day',now())-interval '2 days')", [id.campaignA]);
  return result;
}
async function reserve({ company = id.companyA, campaign = id.campaignA, user = id.userA, key = randomUUID(), cost = 0.01, provider = "openai", operation = "generate_brief" } = {}) {
  return (await one("select begin_provider_operation($1,$2,$3,$4,$5,null,$6,$7) as reservation", [company, campaign, user, provider, operation, key, cost])).reservation;
}
async function finish(event, status = "success", extra = {}) {
  await q("select finish_provider_operation($1,$2::jsonb)", [event, JSON.stringify({ status, latency_ms: 100, ...extra })]);
}

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
    alter table storage.objects enable row level security;
    alter table storage.buckets enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant all on all tables in schema storage to anon,authenticated,service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to authenticated,anon,service_role;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon,service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;`);
  const files = readdirSync(root + "supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
  // Preserve the historical applied dependency order; the original audit hardening timestamp predates its table.
  const hardening = files.splice(files.indexOf("20260923174500_harden_audit_log_privileges.sql"), 1)[0];
  files.splice(files.indexOf("20260923200000_audit_log_foundation.sql") + 1, 0, hardening);
  for (const file of files) {
    const sql = readFileSync(root + "supabase/migrations/" + file, "utf8").replace("create extension if not exists pgcrypto;", "");
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }); }
  }
  for (const user of [id.userA, id.userB, id.operator, id.creatorUser]) await q("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `${user}@example.test`]);
  storyloopId = (await one("select id from companies where slug='storyloop'")).id;
  await q("insert into companies(id,name,slug) values($1,'Brand A','test-brand-a'),($2,'Brand B','test-brand-b')", [id.companyA, id.companyB]);
  await q("insert into brand_memberships(company_id,user_id) values($1,$2),($3,$4)", [id.companyA,id.userA,id.companyB,id.userB]);
  await q("insert into team_memberships(company_id,user_id,role) values($1,$2,'senior')", [storyloopId,id.operator]);
  for (const suffix of ["A", "B"]) {
    await q("insert into brand_campaigns(id,company_id,created_by,title,brand_name,promoted_item,objective,deliverables) values($1,$2,$3,$4,$4,'Product','awareness',array['instagram_reel'])", [id[`campaign${suffix}`],id[`company${suffix}`],id[`user${suffix}`],`Campaign ${suffix}`]);
    await q("insert into brand_competitor_scans(id,company_id,campaign_id,query_hash,status,created_by) values($1,$2,$3,$4,'succeeded',$5)", [id[`scan${suffix}`],id[`company${suffix}`],id[`campaign${suffix}`],`hash-${suffix}`,id[`user${suffix}`]]);
    await q("insert into brand_competitors(id,company_id,campaign_id,scan_id,name,official_domain,rationale,status,verified_at,confirmed_at) values($1,$2,$3,$4,'Competitor','competitor.example','Official source','confirmed',now(),now())", [id[`competitor${suffix}`],id[`company${suffix}`],id[`campaign${suffix}`],id[`scan${suffix}`]]);
    await q("insert into brand_competitor_observations(id,company_id,scan_id,competitor_id,competitor_name,source_url,source_domain,source_title,source_snippet,content_hash,source_record_key,evidence_kind) values($1,$2,$3,$4,'Competitor','https://reddit.example/thread','reddit.example','Customer discussion','A customer concern','content-hash','record-key','reddit_excerpt')", [id[`evidence${suffix}`],id[`company${suffix}`],id[`scan${suffix}`],id[`competitor${suffix}`]]);
  }
  await q("insert into creators(id,display_name) values($1,'Consenting creator')", [id.creator]);
  await q("insert into creator_accounts(user_id,creator_id,company_id) values($1,$2,$3)", [id.creatorUser,id.creator,storyloopId]);
  await q("insert into brand_creator_catalog(id,creator_id,display_name,active,directory_consented_at,published_at) values($1,$2,'Consenting creator',true,now(),now())", [id.catalog,id.creator]);
  await q("insert into brand_creator_rates(id,catalog_id,deliverable_type,unit_rate_cents) values($1,$2,'instagram_reel',125000)", [id.rate,id.catalog]);
});
after(async () => { await db.close(); });

scenario("tenant A sees only its campaigns and cannot create in B or mutate lifecycle directly", async () => {
  await role("authenticated", id.userA);
  assert.deepEqual((await q("select id from brand_campaigns order by id")).rows.map((row) => row.id), [id.campaignA]);
  await fails("insert into brand_campaigns(company_id,created_by,title,brand_name,promoted_item,objective) values($1,$2,'Forged','Forged','Product','awareness')", [id.companyB,id.userA]);
  await fails("update brand_campaigns set status='active' where id=$1", [id.campaignA]);
  await fails("insert into brand_campaigns(company_id,created_by,title,brand_name,promoted_item,objective,status) values($1,$2,'Forged','Forged','Product','awareness','ready_for_desk')", [id.companyA,id.userA]);
  await role("authenticated", id.userB);
  assert.equal((await one("select count(*)::int as count from brand_campaigns where id=$1", [id.campaignA])).count, 0);
});
scenario("anonymous cannot read campaigns or call lifecycle, and brands cannot forge provider spend", async () => {
  await role("anon");
  await fails("select * from brand_campaigns");
  await fails("select transition_brand_campaign($1,'active',now())", [id.campaignA]);
  await role("authenticated", id.userA);
  await fails("insert into external_api_usage_events(company_id,provider_key,operation,status,billed_cost_usd,billed_cost_verified) values($1,'openai','forged','success',0,true)", [id.companyA]);
  await fails("select begin_provider_operation($1,$2,$3,'openai','forged',null,'forged',0)", [id.companyA,id.campaignA,id.userA]);
  assert.equal((await one("select count(*)::int as count from external_api_usage_events")).count, 0);
});
scenario("trusted runtime refuses cross-company authority and duplicate idempotency keys", async () => {
  await role("service_role");
  assert.equal((await reserve({ company: id.companyB })).error, "access_denied");
  const first = await reserve({ key: "same-request" });
  assert.equal(first.allowed, true);
  assert.equal((await reserve({ key: "same-request" })).error, "duplicate_operation");
  assert.equal((await one("select count(*)::int as count from external_api_usage_events")).count, 1);
});
scenario("two overlapping reservations permit one active operation for a campaign/provider", async () => {
  await role("service_role");
  // PGlite serializes SQL on one connection; this asserts the durable active-operation gate, not multi-session scheduling.
  const outcomes = await Promise.all([reserve({ key: "overlap-1" }), reserve({ key: "overlap-2" })]);
  assert.equal(outcomes.filter((result) => result.allowed).length, 1);
  assert.equal(outcomes.find((result) => !result.allowed).error, "operation_running");
  await finish(outcomes.find((result) => result.allowed).event_id);
  assert.equal((await reserve()).allowed, true);
});
scenario("daily and hourly caps exclude locally denied attempts from quota use", async () => {
  await role("service_role");
  await q("update api_provider_policies set daily_company_limit=1,hourly_campaign_limit=10 where provider_key='openai'");
  const first = await reserve(); await finish(first.event_id);
  assert.equal((await reserve()).error, "app_daily_limit");
  await q("update api_provider_policies set daily_company_limit=10,hourly_campaign_limit=1 where provider_key='openai'");
  assert.equal((await reserve()).error, "app_hourly_limit");
  await q("update api_provider_policies set hourly_campaign_limit=2 where provider_key='openai'");
  assert.equal((await reserve()).allowed, true);
});
scenario("five provider failures open the circuit; a provider 429 honors retry-after", async () => {
  await role("service_role");
  await q("update api_provider_policies set hourly_campaign_limit=20 where provider_key='openai'");
  for (let index = 0; index < 5; index++) { const operation = await reserve(); assert.equal(operation.allowed, true); await finish(operation.event_id, "failed"); }
  assert.equal((await reserve()).error, "provider_circuit_open");
  await q("update api_provider_policies set blocked_until=null,consecutive_failures=0 where provider_key='openai'");
  const limited = await reserve(); await finish(limited.event_id, "rate_limited", { retry_after: 120 });
  assert.equal((await reserve()).error, "provider_circuit_open");
  assert.equal((await one("select blocked_until >= now()+interval '119 seconds' as respected from api_provider_policies where provider_key='openai'")).respected, true);
});
scenario("daily spend budgets are per company and reserve cost before a provider request", async () => {
  await role("service_role");
  await q("update api_provider_policies set daily_budget_usd=0.10 where provider_key='openai'");
  const first = await reserve({ cost: 0.08 }); await finish(first.event_id);
  assert.equal((await reserve({ cost: 0.03 })).error, "daily_spend_limit");
  assert.equal((await reserve({ company: id.companyB,campaign: id.campaignB,user: id.userB,cost: 0.08 })).allowed, true);
});
scenario("missing cost reservations and previous unknown costs fail closed when a budget is configured", async () => {
  await role("service_role");
  const unknown = await reserve({ cost: null }); await finish(unknown.event_id);
  await q("update api_provider_policies set daily_budget_usd=5 where provider_key='openai'");
  assert.equal((await reserve({ cost: null })).error, "cost_estimate_required");
  assert.equal((await reserve({ cost: 0.1 })).error, "unreconciled_costs");
});
scenario("interrupted reservations become unknown without silently freeing an unpriced budget", async () => {
  await role("service_role");
  const interrupted = await reserve({ cost: null });
  await q("update external_api_usage_events set created_at=now()-interval '6 minutes' where id=$1", [interrupted.event_id]);
  await q("update api_provider_policies set daily_budget_usd=5 where provider_key='openai'");
  assert.equal((await reserve({ cost: 0.1 })).error, "unreconciled_costs");
  assert.equal((await one("select status from external_api_usage_events where id=$1", [interrupted.event_id])).status, "unknown");
});
scenario("brief approval rejects missing drafts, stale revisions and foreign citations", async () => {
  await role("authenticated", id.userA);
  await fails("select save_brand_campaign_brief($1,0,$2::jsonb,true,null)", [id.campaignA,JSON.stringify(brief())], /no_plan/);
  await fails("select save_brand_campaign_brief($1,0,$2::jsonb,false,null)", [id.campaignA,JSON.stringify(brief(id.evidenceB))], /invalid_citations/);
  assert.equal(await saveBrief(), 1);
  await fails("select save_brand_campaign_brief($1,0,$2::jsonb,true,null)", [id.campaignA,JSON.stringify(brief())], /revision_conflict/);
  assert.equal(await saveBrief({ revision: 1, approve: true }), 2);
  await role("authenticated", id.userB);
  await fails("select save_brand_campaign_brief($1,2,$2::jsonb,true,null)", [id.campaignA,JSON.stringify(brief())], /campaign_access/);
});
scenario("creator selection snapshots curated rates and rejects tampering and stale quotes", async () => {
  await approvedPlan();
  const selection = await one("select set_brand_creator_selection($1,$2,2,125000) as id", [id.campaignA,id.rate]);
  assert.equal(Number((await one("select unit_rate_cents from brand_campaign_creator_selections where id=$1", [selection.id])).unit_rate_cents), 125000);
  await fails("update brand_campaign_creator_selections set unit_rate_cents=1 where id=$1", [selection.id]);
  await role("service_role"); await q("update brand_creator_rates set unit_rate_cents=150000 where id=$1", [id.rate]);
  await role("authenticated", id.userA);
  assert.equal(Number((await one("select unit_rate_cents from brand_campaign_creator_selections where id=$1", [selection.id])).unit_rate_cents), 125000);
  await fails("select set_brand_creator_selection($1,$2,2,125000)", [id.campaignA,id.rate], /rate_changed/);
  await q("select set_brand_creator_selection($1,$2,2,150000)", [id.campaignA,id.rate]);
  assert.equal(Number((await one("select unit_rate_cents from brand_campaign_creator_selections where id=$1", [selection.id])).unit_rate_cents), 150000);
});
scenario("unpublished or withdrawn creator consent removes discovery and blocks selection", async () => {
  await approvedPlan();
  await role("service_role"); await q("update brand_creator_catalog set active=false where id=$1", [id.catalog]);
  await role("authenticated", id.userA);
  assert.equal((await one("select count(*)::int as count from brand_creator_catalog")).count, 0);
  await fails("select set_brand_creator_selection($1,$2,1,125000)", [id.campaignA,id.rate], /creator_unavailable/);
});
scenario("launch requires the current approved brief and creative; completion cannot reactivate", async () => {
  await role("authenticated", id.userA);
  await fails("select transition_brand_campaign($1,'active',now())", [id.campaignA]);
  await approvedPlan();
  await fails("select transition_brand_campaign($1,'active',now())", [id.campaignA]);
  // Use the approved plan created above; persist a matching creative as trusted generation would.
  await role("service_role");
  const creative = (await one("insert into brand_campaign_creatives(campaign_id,company_id,content,plan_revision) values($1,$2,$3::jsonb,2) returning id", [id.campaignA,id.companyA,JSON.stringify(concepts)])).id;
  await role("authenticated", id.userA); await q("select approve_brand_creative($1,1)", [creative]);
  await fails("select transition_brand_campaign($1,'active',now()+interval '1 day')", [id.campaignA]);
  await q("select transition_brand_campaign($1,'active',now()-interval '2 days')", [id.campaignA]);
  await fails("select save_brand_campaign_brief($1,2,$2::jsonb,false,null)", [id.campaignA,JSON.stringify(brief())], /read_only/);
  await fails("select transition_brand_campaign($1,'completed',now()-interval '3 days')", [id.campaignA]);
  await q("select transition_brand_campaign($1,'completed',now())", [id.campaignA]);
  await fails("select transition_brand_campaign($1,'active',now())", [id.campaignA], /Invalid campaign transition/);
});
scenario("daily metric upserts replace duplicate source/day values and enforce tenant/date boundaries", async () => {
  await launch();
  await role("authenticated", id.operator);
  const sql = "insert into brand_campaign_metrics(company_id,campaign_id,metric_date,platform,external_post_id,source_type,source_reference,views,recorded_by) values($1,$2,(now() at time zone 'UTC')::date,'instagram','post-1','manual_export','export.csv',$3,$4) on conflict(campaign_id,platform,external_post_id,metric_date) do update set views=excluded.views returning id";
  const first = await one(sql, [id.companyA,id.campaignA,100,id.operator]);
  const second = await one(sql, [id.companyA,id.campaignA,250,id.operator]);
  assert.equal(first.id,second.id);
  assert.equal((await one("select count(*)::int as count from brand_campaign_metrics")).count, 1);
  assert.equal(Number((await one("select views from brand_campaign_metrics where id=$1", [first.id])).views),250);
  await fails(sql, [id.companyB,id.campaignA,300,id.operator]);
  await fails("update brand_campaign_metrics set metric_date=(now() at time zone 'UTC')::date+1 where id=$1", [first.id]);
  await fails("update brand_campaign_metrics set metric_date=(now() at time zone 'UTC')::date-4 where id=$1", [first.id]);
  await role("authenticated", id.userB); assert.equal((await one("select count(*)::int as count from brand_campaign_metrics")).count,0);
  await role("authenticated", id.userA); assert.equal((await one("select count(*)::int as count from brand_campaign_metrics")).count,1);
  assert.equal((await q("update brand_campaign_metrics set views=999 where id=$1 returning id", [first.id])).rows.length,0);
  assert.equal(Number((await one("select views from brand_campaign_metrics where id=$1", [first.id])).views),250);
});
scenario("creative edits revoke creator consent and private provider payloads stay server-only", async () => {
  const { creative } = await approvedCreative();
  await role("service_role");
  const request = (await one("insert into brand_preview_requests(company_id,campaign_id,creative_id,creative_revision,creator_id,kind,campaign_title,brand_name,prompt,request_hash,status,reference_object_key,reference_sha256,consented_by,expires_at,created_by) values($1,$2,$3,1,$4,'image','Campaign A','Brand A','A prompt for an approved creator preview.','request-hash','approved','private-reference.webp','hash',$5,now()+interval '1 day',$6) returning id", [id.companyA,id.campaignA,creative,id.creator,id.creatorUser,id.userA])).id;
  const job = (await one("insert into brand_preview_jobs(request_id,company_id,campaign_id,model,kind,status,estimated_cost_usd,estimated_credits,quote_expires_at) values($1,$2,$3,'test-model','image','quoted',0.1,1,now()+interval '10 minutes') returning id", [request,id.companyA,id.campaignA])).id;
  await q("insert into brand_preview_job_private(job_id,request_payload) values($1,'{}')", [job]);
  await role("authenticated", id.creatorUser);
  assert.equal((await one("select count(*)::int as count from brand_preview_requests where id=$1", [request])).count,1);
  await fails("select * from brand_preview_job_private");
  await role("authenticated", id.userB); assert.equal((await one("select count(*)::int as count from brand_preview_requests where id=$1", [request])).count,0);
  await role("authenticated", id.userA);
  await fails("select * from brand_preview_job_private");
  await q("select save_brand_creative($1,1,$2::jsonb)", [creative,JSON.stringify(concepts)]);
  assert.equal((await one("select status from brand_preview_requests where id=$1", [request])).status,"revoked");
  assert.equal((await one("select approval_state from brand_campaign_creatives where id=$1", [creative])).approval_state,"draft");
});
scenario("a new brief revision invalidates creative approval and prevents launch of stale creative", async () => {
  const { creative, planRevision } = await approvedCreative();
  await saveBrief({ revision: planRevision, content: { ...brief(), summary: "A revised campaign summary" } });
  assert.equal((await one("select approval_state from brand_campaign_creatives where id=$1", [creative])).approval_state,"draft");
  await fails("select approve_brand_creative($1,1)", [creative], /Creative or brief changed/);
  await fails("select transition_brand_campaign($1,'active',now())", [id.campaignA]);
});
scenario("actual provider invoices remain distinct, unique, operator-readable and server-write-only", async () => {
  await role("service_role");
  const insert = "insert into external_api_bills(provider_key,invoice_reference,amount_usd,billed_at,period_start,period_end,recorded_by) values('serpapi','TEST-USD-INVOICE',75,(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date-30,(now() at time zone 'UTC')::date,$1)";
  await q(insert,[id.operator]);
  await fails(insert,[id.operator],/duplicate key/);
  assert.equal((await one("select count(*)::int as count from external_api_usage_events")).count,0);
  await role("authenticated",id.userA);
  assert.equal((await one("select count(*)::int as count from external_api_bills")).count,0);
  await fails(insert,[id.userA]);
  await role("authenticated",id.operator);
  assert.equal((await one("select count(*)::int as count from external_api_bills")).count,1);
  await fails("update external_api_bills set amount_usd=0");
  await role("anon");
  await fails("select * from external_api_bills");
});
scenario("competitor shortlist admits at most five nonrejected brands across manual adds and reconfirmation", async () => {
  await role("service_role");
  const insert = "insert into brand_competitors(company_id,campaign_id,scan_id,name,official_domain,rationale,status,verified_at) values($1,$2,$3,'Manual competitor',$4,'Brand-confirmed official domain',$5,now()) returning id";
  const create = (domain,status="candidate") => one(insert,[id.companyA,id.campaignA,id.scanA,domain,status]);
  const additions = [];
  for (let index=0;index<4;index++) additions.push(await create(`manual-${index}.example`));
  assert.equal((await one("select count(*)::int as count from brand_competitors where scan_id=$1 and status<>'rejected'",[id.scanA])).count,5);
  await fails(insert,[id.companyA,id.campaignA,id.scanA,"sixth-candidate.example","candidate"],/five_competitors/);
  await fails(insert,[id.companyA,id.campaignA,id.scanA,"sixth-confirmed.example","confirmed"],/five_competitors/);
  const rejected = await create("rejected-brand.example","rejected");
  await fails("update brand_competitors set status='confirmed' where id=$1",[rejected.id],/five_competitors/);
  // Updating an existing member of the five must not count that row twice.
  await q("update brand_competitors set status='confirmed' where id=$1",[additions[0].id]);
  await q("update brand_competitors set status='rejected' where id=$1",[additions[1].id]);
  await q("update brand_competitors set status='confirmed' where id=$1",[rejected.id]);
  assert.equal((await one("select count(*)::int as count from brand_competitors where scan_id=$1 and status<>'rejected'",[id.scanA])).count,5);
  await fails("update brand_competitors set status='candidate' where id=$1",[additions[1].id],/five_competitors/);
});
scenario("launch freezes competitor, product and observation writes even from the trusted service role", async () => {
  await role("service_role");
  const productSql = "insert into brand_competitor_products(company_id,campaign_id,competitor_id,scan_id,asin,title,source_url,observed_at) values($1,$2,$3,$4,$5,'Product','https://amazon.in/dp/B000TEST01',now()) returning id";
  const product = await one(productSql,[id.companyA,id.campaignA,id.competitorA,id.scanA,"B000TEST01"]);
  await launch();
  await role("service_role");
  await fails("update brand_competitors set status='rejected' where id=$1",[id.competitorA],/campaign_read_only/);
  await fails("insert into brand_competitors(company_id,campaign_id,scan_id,name,official_domain,rationale,verified_at) values($1,$2,$3,'Late competitor','late.example','A new source',now())",[id.companyA,id.campaignA,id.scanA],/campaign_read_only/);
  await fails("update brand_competitor_products set status='selected' where id=$1",[product.id],/campaign_read_only/);
  await fails(productSql,[id.companyA,id.campaignA,id.competitorA,id.scanA,"B000TEST02"],/campaign_read_only/);
  await fails("insert into brand_competitor_observations(company_id,scan_id,competitor_id,competitor_name,source_url,source_domain,source_title,source_snippet,content_hash,source_record_key,evidence_kind) values($1,$2,$3,'Competitor','https://reddit.example/late','reddit.example','Late discussion','A newly observed concern','late-hash','late-record','reddit_excerpt')",[id.companyA,id.scanA,id.competitorA],/campaign_read_only/);
  await fails("update brand_competitor_observations set source_snippet='Changed after launch' where id=$1",[id.evidenceA],/immutable/);
  assert.equal((await one("select status from brand_competitors where id=$1",[id.competitorA])).status,"confirmed");
  assert.equal((await one("select status from brand_competitor_products where id=$1",[product.id])).status,"candidate");
});

scenario('Supabase asset buckets are private and direct client file access is denied', async () => {
  const buckets = (await q("select id,public,file_size_limit from storage.buckets order by id")).rows;
  assert.deepEqual(buckets.map(b=>[b.id,b.public,Number(b.file_size_limit)]), [['storyloop-brand-assets',false,5242880],['storyloop-private-media',false,52428800]]);
  // Metadata-only fixture in isolated WASM Postgres, never a live Storage write.
  await q("insert into storage.objects(bucket_id,name) values('storyloop-private-media','private/test.png')");
  for (const client of ['anon','authenticated']) {
    await role(client,id.userA);
    assert.equal((await one('select count(*)::int as n from storage.objects')).n,0);
    await fails("insert into storage.objects(bucket_id,name) values('storyloop-private-media','forged.png')");
    assert.equal((await q("delete from storage.objects returning id")).rows.length,0);
  }
  await role('service_role');
  assert.equal((await one('select count(*)::int as n from storage.objects')).n,1);
});
