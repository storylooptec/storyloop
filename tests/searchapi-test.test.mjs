import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64')}`;
const competitionUrl=new URL('../src/brand/competition.ts',import.meta.url).href;
const normalizeUrl=moduleUrl((await readFile(new URL('../src/brand/research-normalize.ts',import.meta.url),'utf8')).replace('from "./competition"',`from ${JSON.stringify(competitionUrl)}`));
const adapterUrl=moduleUrl((await readFile(new URL('../src/lib/providers/searchapi.ts',import.meta.url),'utf8')).replace('import "server-only";','').replace('from "@/brand/research-normalize"',`from ${JSON.stringify(normalizeUrl)}`).replace('from "@/brand/competition"',`from ${JSON.stringify(competitionUrl)}`));
const cacheUrl=moduleUrl(`const cache=new Map(); export function unstable_cache(fn,keys){return async()=>{const key=JSON.stringify(keys);if(!cache.has(key))cache.set(key,await fn());return cache.get(key);}}`);
const probeUrl=moduleUrl((await readFile(new URL('../src/lib/providers/searchapi-test.ts',import.meta.url),'utf8')).replace('import "server-only";','').replace('from "next/cache"',`from ${JSON.stringify(cacheUrl)}`).replace('from "./searchapi"',`from ${JSON.stringify(adapterUrl)}`));
const {testSearchApi}=await import(probeUrl);
const names=['SEARCHAPI_API_KEY','SEARCHAPI_KEY','SEARCH_API_KEY','SEARCHAPI_ENABLED','OPENAI_API_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'];

async function environment(values, fetcher, run){
  const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const previous=globalThis.fetch;
  for(const name of names)delete process.env[name];
  Object.assign(process.env,values);
  globalThis.fetch=fetcher;
  try{await run();}finally{globalThis.fetch=previous;for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
}

test('missing key and disabled provider send zero requests',async()=>{
  for(const values of [{},{SEARCH_API_KEY:'configured',SEARCHAPI_ENABLED:'false'}]){
    await environment(values,()=>{throw new Error('Must not fetch');},async()=>{
      const result=await testSearchApi();
      assert.equal(result.ok,false);assert.equal(result.retryAt,0);
      assert.match(result.message,/No search request was sent/);
    });
  }
});

test('fixed query uses one call without research/OpenAI credentials; repeated clicks reuse it',async()=>{
  let requests=0;
  await environment({SEARCH_API_KEY:'test-probe-success'},async(url,init)=>{
    requests++;
    assert.equal(url.origin,'https://www.searchapi.io');
    assert.equal(url.pathname,'/api/v1/search');
    assert.deepEqual(Object.fromEntries(url.searchParams),{engine:'google',q:'oral care toothpaste brands India',gl:'in',hl:'en'});
    assert.equal(init.headers.Authorization,'Bearer test-probe-success');
    await new Promise(resolve=>setTimeout(resolve,20));
    return Response.json({search_metadata:{status:'Success'},organic_results:[
      {title:'Unsafe',link:'javascript:alert(1)'},
      ...Array.from({length:7},(_,i)=>({title:`Brand ${i}`,link:`https://brand${i}.example/products?api_key=secret`,snippet:'Toothpaste range'})),
    ]});
  },async()=>{
    const [first,parallel]=await Promise.all([testSearchApi(),testSearchApi()]);
    const repeated=await testSearchApi();
    assert.equal(requests,1);assert.equal(first.ok,true);assert.equal(first.httpStatus,200);
    assert.equal(first.reused,false);assert.equal(parallel.reused,true);assert.equal(repeated.reused,true);
    assert.equal(first.results.length,5);assert.match(first.results[0].url,/^https:/);
    assert.doesNotMatch(JSON.stringify(first),/api_key|secret|javascript|test-probe-success/);
    assert.ok(first.retryAt>Date.now());
  });
});

test('provider failures expose status but not credentials or raw bodies, and are not retried',async()=>{
  for(const status of [401,429,500]){
    let requests=0;
    await environment({SEARCHAPI_API_KEY:`probe-error-${status}`},async()=>{
      requests++;return new Response('raw private key and billing details',{status});
    },async()=>{
      const result=await testSearchApi();await testSearchApi();
      assert.equal(result.ok,false);assert.equal(result.httpStatus,status);assert.equal(requests,1);
      assert.match(result.code,/provider_/);assert.doesNotMatch(JSON.stringify(result),/private key|billing|probe-error/);
    });
  }
});

test('uncertain transport outcomes are cached and key rotation permits a fresh test',async()=>{
  let requests=0;
  await environment({SEARCHAPI_KEY:'probe-transport'},async()=>{requests++;throw new Error('sensitive URL');},async()=>{
    const result=await testSearchApi();await testSearchApi();
    assert.equal(requests,1);assert.equal(result.httpStatus,null);assert.equal(result.code,'provider_unavailable');
    process.env.SEARCHAPI_KEY='probe-rotated';await testSearchApi();assert.equal(requests,2);
    assert.doesNotMatch(JSON.stringify(result),/sensitive URL/);
  });
});
