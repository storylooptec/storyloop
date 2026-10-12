import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {sessionCookie,campaignId,researchTestState} from './mock-supabase.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
try {
 const context=await browser.newContext({viewport:{width:1360,height:900}});
 await context.addCookies([{name:'sb-127-auth-token',value:sessionCookie(),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage();
 await page.goto(process.env.BRAND_TEST_ORIGIN+`/brand/campaigns/${campaignId}/competitors`);
 await page.getByRole('button',{name:'Scan competition',exact:true}).click();
 try {
  await page.waitForURL(/error=(research_not_configured|provider_not_configured)/,{timeout:10000});
 } catch(error) {
  console.log('OBSERVED SCREEN:',await page.locator('body').innerText());
  throw error;
 }
 assert.equal(await page.locator('h1').innerText(),'Understand the competition');
 await page.locator('main [role=alert]').filter({hasText:'Your campaign is saved'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Scan competition',exact:true}).isEnabled(),true);
 assert.doesNotMatch(await page.locator('body').innerText(),/This page couldn.t load|Application error/);
 console.log('PASS research startup failure stays inside the campaign page and preserves the draft');
 if(!process.argv.includes('--without-service-key')) {
  researchTestState.failScanRead=true;
  await page.getByRole('button',{name:'Scan competition',exact:true}).click();
  await page.waitForURL('**/competitors?error=evidence_save_failed');
  await page.locator('main [role=alert]').filter({hasText:'Your campaign is saved'}).waitFor();
  assert.equal(await page.locator('h1').innerText(),'Understand the competition');
  assert.doesNotMatch(await page.locator('body').innerText(),/This page couldn.t load|Application error/);
  console.log('PASS database failure during scan setup is caught before any provider call');
 }
 await page.reload();
 assert.equal(await page.locator('h1').innerText(),'Understand the competition');
} finally {await browser.close();}
