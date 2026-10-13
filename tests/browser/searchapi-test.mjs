import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startResearchFixture,sessionCookie,campaignId,researchState} from './research-fixture.mjs';

const fixture=await startResearchFixture();
const origin='http://127.0.0.1:3001';
let calls=0,status=200,server,browser,output='';
const provider=http.createServer(async(req,res)=>{
  calls++;await pause(250);
  assert.equal(new URL(req.url,'http://fixture').searchParams.get('q'),'oral care toothpaste brands India');
  res.writeHead(status,{'Content-Type':'application/json'});
  res.end(JSON.stringify(status===200?{search_metadata:{status:'Success'},organic_results:Array.from({length:7},(_,i)=>({title:`Test oral care result ${i+1}`,link:`https://brand${i+1}.example/products`,snippet:'Synthetic browser-test result; no live provider was contacted.'}))}:{error:'private provider body must not be displayed'}));
});
await new Promise(resolve=>provider.listen(4547,'127.0.0.1',resolve));
async function stop(){if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}}
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  for(const mode of ['success','rejected','missing']){
    status=mode==='rejected'?401:200;calls=0;output='';
    server=spawn(process.execPath,['--import',fileURLToPath(new URL('./searchapi-test-network-guard.mjs',import.meta.url)),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001'],{
      env:{...process.env,SUPABASE_URL:'http://127.0.0.1:4545',SUPABASE_PUBLISHABLE_KEY:'test-public-key',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',OPENAI_API_KEY:'',SEARCH_API_KEY:mode==='missing'?'':`test-${mode}-${Date.now()}`,SEARCHAPI_API_KEY:'',SEARCHAPI_KEY:'',SEARCHAPI_ENABLED:'true',NEXT_PUBLIC_SITE_URL:origin},stdio:['ignore','pipe','pipe'],
    });
    server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
    let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/brand')).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addCookies([{name:'sb-127-auth-token',value:sessionCookie(),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
    const page=await context.newPage();const errors=[];let actionRequest;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.headers()['next-action'])actionRequest=request;});
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const path=`/brand/campaigns/${campaignId}/competitors?error=research_not_configured`;
    await page.goto(origin+path);
    const panel=page.getByRole('region',{name:'Test SearchAPI',exact:true});
    await panel.getByRole('button',{name:'Test SearchAPI',exact:true}).evaluate(node=>{node.click();node.click();});
    await panel.getByText(mode==='success'?'SearchAPI is working. The search returned results.':mode==='rejected'?'SearchAPI rejected the key. Check the key linked to this deployment.':/This deployment cannot read a valid SearchAPI key/).waitFor();
    assert.equal(calls,mode==='missing'?0:1);assert.equal(researchState.enqueues,0);
    if(mode==='success'){
      assert.equal(await panel.getByRole('link').count(),5);
      await mkdir('tests/browser/artifacts',{recursive:true});
      await page.screenshot({path:'tests/browser/artifacts/searchapi-test-desktop.png'});
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await panel.screenshot({path:'tests/browser/artifacts/searchapi-test-mobile.png'});
      await page.reload();await panel.getByRole('button',{name:'Test SearchAPI',exact:true}).click();
      await panel.getByText(/Reused test response; no new search/).waitFor();assert.equal(calls,1);
      const anonymous=await browser.newContext();
      const response=await anonymous.request.post(origin+path,{headers:{'next-action':actionRequest.headers()['next-action'],'content-type':actionRequest.headers()['content-type'],origin},data:actionRequest.postData(),maxRedirects:0});
      assert.match(response.headers()['x-action-redirect']??'',/\/brand\?error=login/);
      await anonymous.close();
    }else if(mode==='rejected'){
      assert.match(await panel.innerText(),/HTTP 401/);assert.doesNotMatch(await panel.innerText(),/private provider body/);
    }
    assert.deepEqual(errors,[]);assert.doesNotMatch(output,/blocked an external request|Application error/);
    console.log(`PASS ${mode}: ${calls} provider calls; no research secret, OpenAI key or research enqueue`);
    await context.close();await stop();
  }
}finally{await browser?.close();await stop();await new Promise(resolve=>provider.close(resolve));await fixture.close();}
