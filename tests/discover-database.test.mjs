import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const user='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
let company;
const sql=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const record=(handle='test_import')=>({fields:{name:'Local Test Creator',instagram:`https://instagram.com/${handle}/`,er:.0404,followers:1000,reel:150000,location:null,source:null},row:2,filename:'test.csv',sheet:'CSV',headers:['NAME','INSTAGRAM URL'],raw:['Local Test Creator',`https://instagram.com/${handle}/`]});
async function role(uid=user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');}
async function run(data=record(),target=company){return (await db.query('select public.import_discover_creator($1,$2::jsonb) as result',[target,JSON.stringify(data)])).rows[0].result;}
before(async()=>{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(sql('supabase/migrations/20260923135600_company_foundation.sql').replace('create extension if not exists pgcrypto;',''));
 await db.exec(sql('supabase/migrations/20260923142900_team_roles_permissions_foundation.sql'));
 await db.exec(sql('supabase/migrations/20260923224634_creator_hub_foundation.sql').split('insert into public.company_configuration')[0]);
 await db.exec(sql('supabase/migrations/20260924083341_admin_creator_data_read.sql'));
 company=(await db.query("select id from companies where slug='storyloop'")).rows[0].id;
 await db.query('insert into auth.users(id) values($1),($2)',[user,other]);
 await db.query("insert into team_memberships(company_id,user_id,role) values($1,$2,'junior')",[company,user]);
 await db.exec(sql('supabase/setup/discover-import.sql'));
 // Reapplying must be safe and leave the existing data intact.
 await db.exec(sql('supabase/setup/discover-import.sql'));
});
after(async()=>{await db.close();});
test('anonymous and nonmembers cannot import',async()=>{
 await role(other);await assert.rejects(run(),/Not authorized/);
 await role('');await assert.rejects(run(),/Not authorized/);
 await db.exec('reset role; set role anon');await assert.rejects(run(),/permission denied/);
});
test('operator imports atomically without an Auth creator account; company can read socials',async()=>{
 await role();const result=await run();assert.equal(result.status,'imported');
 const rows=(await db.query('select metadata from company_creators where creator_id=$1',[result.creator_id])).rows;
 assert.equal(rows[0].metadata.discover.fields.er,.0404);assert.equal(rows[0].metadata.discover.fields.location,null);assert.equal(rows[0].metadata.discover.row,2);
 assert.equal((await db.query('select * from creator_social_accounts where creator_id=$1',[result.creator_id])).rows.length,1);
 assert.equal((await db.query('select * from creator_accounts where creator_id=$1',[result.creator_id])).rows.length,0);
 await role(other);assert.equal((await db.query('select * from creator_social_accounts where creator_id=$1',[result.creator_id])).rows.length,0);
});
test('retry / case / URL variants are duplicates and do not overwrite',async()=>{
 await role();const r=record();r.fields.instagram='https://www.instagram.com/TEST_IMPORT/?igsh=123';r.fields.name='MUST NOT OVERWRITE';
 assert.equal((await run(r)).status,'duplicate');assert.equal((await db.query("select display_name from creators where primary_handle='test_import'")).rows[0].display_name,'Local Test Creator');
});
test('invalid fields do not leave orphan identities',async()=>{
 await role();const count=(await db.query('select count(*)::int as n from creators')).rows[0].n;
 for(const patch of [{er:4.04},{followers:-1},{reel:'invalid'},{instagram:'https://evil.test/x'},{email:'bad'}])await assert.rejects(run({...record('invalid_test'),fields:{...record('invalid_test').fields,...patch}}));
 assert.equal((await db.query('select count(*)::int as n from creators')).rows[0].n,count);
});
test('legacy profile URLs are checked without backfill or mutation',async()=>{
 await db.exec('reset role');
 const creator=(await db.query("insert into creators(display_name) values('Legacy') returning id")).rows[0].id;
 await db.query('insert into company_creators(company_id,creator_id) values($1,$2)',[company,creator]);
 await db.query("insert into creator_social_accounts(creator_id,profile_url) values($1,'https://www.instagram.com/Legacy_Name/?hl=en')",[creator]);
 await role();assert.equal((await run(record('legacy_name'))).status,'duplicate');
});
test('company authorization is checked even when caller has membership elsewhere',async()=>{
 await db.exec('reset role');const target=(await db.query("insert into companies(name,slug) values('Other company','other') returning id")).rows[0].id;
 await role();await assert.rejects(run(record('other_company'),target),/Not authorized/);
});
