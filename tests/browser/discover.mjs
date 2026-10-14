// Isolated browser test. All data and RPC writes stay in this in-memory HTTP fixture.
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sessionCookie,userId,companyId} from './mock-supabase.mjs';
const now='2026-10-14T10:00:00Z';
let capability=true, failRead=false, empty=false;
let rows=[];
function row(name,handle,followers,location,category){const creator_id=crypto.randomUUID();return {creator_id,id:creator_id,company_id:companyId,source:null,metadata:{discover:{fields:{name,instagram:`https://instagram.com/${handle}/`,followers,views:null,er:.0404,reel:0,location,category},filename:'fixture.csv',sheet:'CSV',row:2,raw:[name,handle],headers:['NAME','INSTAGRAM URL'],imported_at:now}},updated_at:now,creators:{display_name:name,primary_handle:handle,metadata:{},updated_at:now}};}
rows=[row('Test Alpha','alpha',1000,'Mumbai','Fashion'),row('Test Beta','beta',null,null,'Food')];
const fixture=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:userId,email:'local-admin@example.test',role:'authenticated',aud:'authenticated'}));return;}
 if(url.pathname.endsWith('/rpc/discover_import_ready')){if(!capability){res.statusCode=404;res.end(JSON.stringify({code:'PGRST202',message:'Not installed'}));}else res.end('true');return;}
 if(url.pathname.endsWith('/rpc/import_discover_creator')){
  let body='';for await(const c of req)body+=c;const {p_record}=JSON.parse(body);const h=p_record.fields.instagram.split('/').filter(Boolean).at(-1);
  if(rows.some(r=>r.creators.primary_handle===h)){res.end(JSON.stringify({status:'duplicate'}));return;}
  const r=row(p_record.fields.name,h,p_record.fields.followers,p_record.fields.location,p_record.fields.category);r.metadata.discover={...p_record,instagram_handle:h,imported_at:now};r.source=p_record.fields.source;rows.push(r);res.end(JSON.stringify({status:'imported',creator_id:r.creator_id}));return;
 }
 const name=url.pathname.split('/').at(-1);let data=[];
 if(name==='team_memberships')data=[{company_id:companyId,user_id:userId,role:'senior',status:'active'}];
 if(name==='admin_user_preferences')data=[{admin_onboarding_completed:true}];
 if(name==='company_creators'){if(failRead){res.statusCode=503;res.end(JSON.stringify({message:'fixture read unavailable'}));return;} data=empty?[]:rows;}
 if(name==='creator_social_accounts')data=empty?[]:rows.map(r=>({creator_id:r.creator_id,profile_url:r.metadata.discover.fields.instagram,platform:'instagram',handle:r.creators.primary_handle,verification_status:'imported_unverified',metadata:{},updated_at:now}));
 const total=data.length;
 const offset=Number(url.searchParams.get('offset')||0);const limit=Number(url.searchParams.get('limit')||10000);data=data.slice(offset,offset+limit);
 res.setHeader('Content-Range',data.length?`${offset}-${offset+data.length-1}/${total}`:`*/${total}`);
 res.end(JSON.stringify((req.headers.accept||'').includes('application/vnd.pgrst.object+json')?data[0]??null:data));
});
await new Promise(resolve=>fixture.listen(4546,'127.0.0.1',resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3002'],{env:{...process.env,SUPABASE_URL:'http://127.0.0.1:4546',SUPABASE_PUBLISHABLE_KEY:'local-test-key'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3002/admin/login')).ok)break;}catch{}await setTimeout(100);if(i===99)throw Error(log);}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:3002';
 await page.goto(origin+'/admin/discover');await page.waitForURL('**/admin/login');
 await context.addCookies([{name:'sb-127-auth-token',value:sessionCookie(),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.goto(origin+'/admin/discover');await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
 await page.getByRole('button',{name:'Test Alpha',exact:true}).waitFor();
 await page.getByRole('searchbox').fill('@beta');assert.equal(await page.getByRole('button',{name:'Test Alpha',exact:true}).count(),0);await page.getByRole('button',{name:'Test Beta',exact:true}).waitFor();
 await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Category',{exact:true}).selectOption('Fashion');assert.equal(await page.getByRole('button',{name:'Test Beta',exact:true}).count(),0);
 await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Sort by',{exact:true}).selectOption('followers');await page.getByLabel('Order',{exact:true}).selectOption('asc');assert.match(await page.locator('tbody tr').first().innerText(),/Test Alpha/);
 await page.getByRole('button',{name:'Test Alpha',exact:true}).click();await page.getByRole('heading',{name:'Test Alpha',exact:true}).waitFor();assert.match(await page.locator('dialog').innerText(),/Not supplied/);await page.getByRole('button',{name:'Close details'}).click();
 await page.getByRole('searchbox').fill('No such person');await page.getByRole('heading',{name:'No matching creators'}).waitFor();await page.getByRole('button',{name:'Clear filters'}).click();
 await mkdir(new URL('./artifacts',import.meta.url),{recursive:true});await page.screenshot({path:new URL('./artifacts/discover-desktop.png',import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'mobile no page overflow');await page.screenshot({path:new URL('./artifacts/discover-mobile.png',import.meta.url).pathname,fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Find new creators',exact:true}).click();await page.getByText('Not connected',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Run discovery'}).count(),0);
 await page.getByRole('button',{name:'Import creators',exact:true}).click();
 const csv='SR NO,NAME,INSTAGRAM URL,ER,INSTAGRAM FOLLOWERS,REEL POST\n1,New Local,new_local,0.0404,1234,150000\n2,Already Here,https://instagram.com/ALPHA/?x=y,4.04%,100,2\n3,Bad ER,bad_er,4.04,100,2\n4,Dup One,same_handle,0.02,1,3\n5,Dup Two,@SAME_HANDLE,0.02,1,3';
 await page.getByLabel('Creator file').setInputFiles({name:'test-creators.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await page.getByRole('button',{name:'Validate and preview import'}).waitFor();
 await page.getByLabel('Map NAME',{exact:true}).selectOption('');assert.equal(await page.getByRole('button',{name:'Validate and preview import'}).isDisabled(),true);await page.getByLabel('Map NAME',{exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Validate and preview import'}).click();await page.getByText('1 valid new rows.',{exact:false}).waitFor();
 await page.screenshot({path:new URL('./artifacts/discover-import.png',import.meta.url).pathname,fullPage:true});
 await page.getByRole('button',{name:'Import 1 selected creators'}).click();await page.getByRole('heading',{name:'Import summary'}).waitFor();assert.match(await page.getByRole('region',{name:'Import summary'}).innerText(),/1 imported/);assert.equal(rows.length,3);
 await page.getByRole('button',{name:'Validate and preview import'}).click();await page.getByText('0 valid new rows.',{exact:false}).waitFor();assert.equal(rows.length,3);
 if(process.env.DISCOVER_SAMPLE_PATH){await page.getByLabel('Creator file').setInputFiles(process.env.DISCOVER_SAMPLE_PATH);await page.getByRole('button',{name:'Validate and preview import'}).waitFor();await page.getByRole('button',{name:'Validate and preview import'}).click();await page.getByText('20 valid new rows.',{exact:false}).waitFor();assert.equal(rows.length,3);}
 // Missing migration and empty/error states must be clear and never look like live zero-count results.
 capability=false;await page.goto(origin+'/admin/discover');await page.getByRole('button',{name:'Import creators',exact:true}).click();await page.getByText('Saving is not enabled.',{exact:false}).waitFor();
 empty=true;await page.goto(origin+'/admin/discover');await page.getByRole('heading',{name:'No creators in your database yet'}).waitFor();
 failRead=true;await page.goto(origin+'/admin/discover');await page.getByRole('alert').filter({hasText:'could not be loaded'}).waitFor();assert.equal(await page.getByText('0 matching / 0 loaded creators').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS Discover browser: auth redirect, search, category, sorting, detail, missing/no-match/empty/error states, mobile layout, disconnected provider, CSV mapping, validation, duplicate preview, import summary, retry duplicates and missing SQL.');
}finally{await browser?.close();server.kill();fixture.close();}
