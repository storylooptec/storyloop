import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { sessionCookie,campaignId } from './mock-supabase.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--no-zygote"],headless:true});
await mkdir(new URL('./artifacts',import.meta.url),{recursive:true});
const origin=process.env.BRAND_TEST_ORIGIN||'http://127.0.0.1:3001';
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/brand/logo?*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40"><text x="0" y="28" font-family="sans-serif" font-size="24" fill="#6436e9">Storyloop</text></svg>'}));
await page.goto(origin+'/brand');await page.getByRole('heading',{name:'Welcome back'}).waitFor();
assert.equal(await page.locator('button[formnovalidate]').count(),1,'email code bypasses password validation');
await page.goto(origin+'/brand/home');await page.waitForURL('**/brand?error=login');
await page.goto(origin+'/brand/register');await page.getByRole('heading',{name:'Create your brand account'}).waitFor();
await context.addCookies([{name:'sb-127-auth-token',value:sessionCookie(),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}]);
for(const [path,heading]of [
 ['/brand/home','Pick up where you left off'],['/brand/campaigns/new','Start with your brand'],
 [`/brand/campaigns/${campaignId}/competitors`,'Understand the competition'],['/brand/plan','A clear brief. A considered budget.'],
 ['/brand/discover','Find your campaign’s creators'],['/brand/create','Make an idea worth sharing.'],['/brand/reports','Reports'],[`/brand/campaigns/${campaignId}/manage`,'Summer campaign']]){
 await page.goto(origin+path);await page.locator('h1').waitFor();assert(!page.url().includes('error=access'),'authenticated route available');assert.equal(await page.locator('h1').innerText(),heading);
 assert(!/Application error|Internal Server Error/.test(await page.locator('body').innerText()),path+' rendered');
 console.log('PASS route',path,await page.locator('h1').innerText());
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);assert.equal(overflow,false,path+' desktop no horizontal overflow');
}
await page.goto(origin+'/brand/home');await page.screenshot({path:new URL('./artifacts/brand-home-desktop.png',import.meta.url).pathname,fullPage:true});
await page.setViewportSize({width:390,height:844});
for(const path of ['/brand','/brand/home','/brand/campaigns/new','/brand/discover','/brand/plan','/brand/create','/brand/reports']){
 await page.goto(origin+path);await page.locator('h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false,path+' mobile no horizontal overflow');console.log('PASS mobile',path);
}
await page.goto(origin+'/brand/campaigns/new');await page.screenshot({path:new URL('./artifacts/brand-new-mobile.png',import.meta.url).pathname,fullPage:true});
// Exercise server-action validation and the persisted draft redirect against fixtures.
await page.locator('[name=brand_name]').fill('Test Brand');
await page.locator('[name=promoted_item]').fill('Summer moisturizer');
await page.getByRole('button',{name:'Save & continue'}).click();
await page.getByRole('alert').filter({hasText:'Select at least one deliverable.'}).waitFor();
await page.locator('[name=brand_name]').fill('Test Brand');
await page.locator('[name=promoted_item]').fill('Summer moisturizer');
const checkbox=page.getByLabel('Instagram Reel',{exact:true});const box=await checkbox.boundingBox();assert(box.width<=20&&box.height<=20,'deliverable checkbox remains compact on mobile');await checkbox.check();
await page.getByRole('button',{name:'Save & continue'}).click();
await page.waitForURL('**/brand/campaigns/30000000-0000-4000-8000-000000000002/competitors?created=1');
assert.equal(await page.locator('h1').innerText(),'Understand the competition');
assert.deepEqual(errors,[],'no browser uncaught exceptions');
await browser.close();console.log('PASS unauthenticated redirect, login forms,8 protected routes,7 mobile routes, draft validation and submission, no console page errors');
