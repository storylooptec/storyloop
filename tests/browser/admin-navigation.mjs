// Isolated admin navigation QA; all data is a local fixture.
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {chromium} from 'playwright';
import {sessionCookie,userId,companyId} from './mock-supabase.mjs';
const root=new URL('../../',import.meta.url).pathname;const out=root+'/tests/browser/artifacts/admin-navigation';await mkdir(out,{recursive:true});
const now=new Date().toISOString();let role='senior',failCounts=false;let writes=0;
const fixture=http.createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type','application/json');if(path.endsWith('/rpc/discover_import_ready')){res.end('false');return;}if(req.method!=='GET'&&req.method!=='HEAD'){writes++;res.statusCode=405;res.end('{}');return;}if(path==='/auth/v1/user'){res.end(JSON.stringify({id:userId,email:'review@example.test',role:'authenticated',aud:'authenticated'}));return;}const name=path.split('/').at(-1);if(name==='company_creators'&&failCounts){res.statusCode=403;res.end(JSON.stringify({message:'fixture unavailable'}));return;}const rows= name==='team_memberships'?[{user_id:userId,company_id:companyId,role,status:'active'}]:name==='admin_user_preferences'?[{admin_onboarding_completed:true}]:name==='companies'?[{id:companyId,name:'Local review fixture',slug:'test',status:'active',created_at:now,updated_at:now}]:name==='company_brand_settings'?[{company_id:companyId,default_theme:'dark',dark_colors:{},light_colors:{},gradient:{},typography:{},radius:{},spacing:[0,4,8,12,16,24,32,48,64]}]:[];res.setHeader('Content-Range',rows.length?`0-${rows.length-1}/${rows.length}`:'*/0');res.end(JSON.stringify((req.headers.accept||'').includes('application/vnd.pgrst.object+json')?rows[0]??null:rows));});await new Promise(r=>fixture.listen(4548,'127.0.0.1',r));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3004'],{cwd:root,env:{...process.env,SUPABASE_URL:'http://127.0.0.1:4548',SUPABASE_PUBLISHABLE_KEY:'local-review-key',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe']});server.stderr.on('data',c=>console.error(String(c)));let browser;try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3004/admin/login')).ok)break;}catch{}await setTimeout(100);}browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'sb-127-auth-token',value:sessionCookie(),domain:'127.0.0.1',path:'/'}]);const page=await context.newPage();
const origin='http://127.0.0.1:3004';page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(origin+'/admin');await page.waitForURL('**/admin/home');
assert.deepEqual(await page.locator('nav[aria-label="Admin navigation"] > div > button').evaluateAll(buttons=>buttons.map(button=>button.querySelector('span').textContent)),['Home','Creators','Brands & enquiries','Campaigns','Settings']);
const nav=page.getByRole('navigation',{name:'Admin navigation'});
await nav.getByRole('button',{name:'Settings',exact:true}).click();
assert.equal(await nav.getByRole('link',{name:'Company',exact:true}).isVisible(),true);
assert.equal(await nav.getByRole('link',{name:'Overview & alerts',exact:true}).isVisible(),false);
await nav.getByRole('button',{name:'Settings',exact:true}).press('Enter');
assert.equal(await nav.getByRole('link',{name:'Company',exact:true}).isVisible(),false);
await nav.getByRole('button',{name:'Home',exact:true}).press('Space');
assert.equal(await nav.getByRole('link',{name:'Overview & alerts',exact:true}).isVisible(),true);
assert.equal(await page.getByPlaceholder('Global search — not connected yet').count(),0);
await page.screenshot({path:out+'/home-desktop.png',fullPage:true});
for(const route of ['overview','today']){await page.goto(origin+'/admin/'+route);await page.waitForURL('**/admin/home');}
for(const route of ['creators','add','creators?tab=pool']){await page.goto(origin+'/admin/'+route);await page.waitForURL('**/admin/discover');await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();}
await page.goto(origin+'/admin/settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
const hrefs=await page.locator('main a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));assert.equal(hrefs.length,10);
for(const href of hrefs){await page.goto(origin+href);assert.equal(await page.locator('main h1').count(),1,href);await page.getByRole('link',{name:'← Settings',exact:true}).waitFor();}
await page.goto(origin+'/admin/brands');assert.equal(await page.getByText('Northstar Skincare').count(),0);await page.getByText('Admin brand management is not connected yet').waitFor();
await page.goto(origin+'/admin/campaigns');await page.getByRole('link',{name:'Open campaign measurements'}).click();await page.getByRole('heading',{name:'Campaign metrics',exact:true}).waitFor();await page.getByRole('link',{name:'← Campaigns',exact:true}).waitFor();assert.equal(await page.locator('nav[aria-label="Admin navigation"] a[aria-current="page"]').innerText(),'Campaign measurements');
await page.goto(origin+'/admin/money');await page.getByText('Financial records are not connected').waitFor();assert.equal(await page.getByText('₹6,20,000').count(),0);
failCounts=true;await page.goto(origin+'/admin/home');await page.getByRole('alert').filter({hasText:'could not be loaded'}).waitFor();assert.equal(await page.getByText('Unavailable',{exact:true}).count(),1);failCounts=false;
for(const width of [390,800,860]){await page.setViewportSize({width,height:844});await page.goto(origin+'/admin/home');assert.equal(await page.locator('.admin-sidebar').isVisible(),true);await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('button',{name:'Creators',exact:true}).click();await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Discover',exact:true}).click();await page.waitForURL('**/admin/discover');assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);if(width===390)await page.screenshot({path:out+'/discover-mobile.png',fullPage:true});}
await page.setViewportSize({width:1440,height:1000});role='junior';await page.goto(origin+'/admin/settings/brand');assert.equal(await page.getByRole('button',{name:'Save brand settings',exact:true}).count(),0);await page.getByText('Junior access is read-only.',{exact:false}).waitFor();
await page.goto(origin+'/admin/discover');await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
await page.goto(origin+'/admin/home');await page.getByRole('link',{name:'Help',exact:true}).click();await page.getByRole('heading',{name:'Welcome to Storyloop Admin'}).waitFor();await page.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'Start using Admin'}).click();await page.waitForURL('**/admin/home');assert.equal(await page.getByRole('heading',{name:'Welcome to Storyloop Admin'}).count(),0);
await context.clearCookies();await page.goto(origin+'/admin/settings');await page.waitForURL('**/admin/login');assert.equal(writes,0);assert.deepEqual(errors,[]);
await writeFile(out+'/result.json',JSON.stringify({passed:true,checks:['five destinations','old route redirects','all settings links','campaign measurements','no demo brands or money','error state','390/800/860px menu','junior read-only','auth redirect','no writes']}));console.log('PASS admin consolidation browser checks');
}finally{await browser?.close();server.kill();fixture.close();}
