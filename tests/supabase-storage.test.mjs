import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path, imports = {}) {
  let source = (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace('import "server-only";', '');
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll(`from "${from}"`, `from ${JSON.stringify(to)}`);
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const stub = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const service = stub('export const createServiceSupabaseClient = () => globalThis.storageTest.service;');
const session = stub('export const createServerSupabaseClient = async () => globalThis.storageTest.session;');
const configUrl = await load('src/lib/storage/config.ts');
const config = await import(configUrl);
const objectsUrl = await load('src/lib/storage/objects.ts', { './config': configUrl, '@/lib/supabase/service': service });
const objects = await import(objectsUrl);
const assetUrl = await load('src/lib/storage/brand-assets.ts', { '@/lib/storage/config': configUrl, '@/lib/storage/objects': objectsUrl });
const assets = await import(assetUrl);
const creative = await import(await load('src/brand/creative-assets.ts', { '@/lib/storage/config': configUrl, '@/lib/storage/objects': objectsUrl }));
const routeImports = { '@/lib/storage/config': configUrl, '@/lib/storage/objects': objectsUrl, '@/lib/supabase/server': session, '@/lib/supabase/service': service, '@/brand/creative': new URL('../src/brand/creative.ts', import.meta.url).href };
const logoRoute = await import(await load('src/app/api/brand/logo/route.ts', routeImports));
const campaignRoute = await import(await load('src/app/brand/campaigns/[campaignId]/logo/route.ts', routeImports));
const mediaRoute = await import(await load('src/app/brand/create/media/[jobId]/route.ts', routeImports));
const originalFetch = globalThis.fetch;
const oldEnv = { ...process.env };
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.storageTest; for (const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; } });
const company = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const png = new Uint8Array([137,80,78,71,13,10,26,10,0]);
function setup({ user = {}, tables = {}, error = null, rangeStatus = 206 } = {}) {
  process.env.SUPABASE_URL = 'https://storage.example.test'; process.env.SUPABASE_SECRET_KEY = 'server-test-key';
  const calls = [], stored = new Map();
  const from = table => { const chain = { select: () => chain, eq: (column,value) => { calls.push(['filter',table,column,value]); return chain; }, limit: () => chain, maybeSingle: async () => ({ data: tables[table] ?? null }) }; calls.push(['table',table]); return chain; };
  const storage = { from: bucket => ({
    upload: async (key,body,options) => { calls.push(['upload',bucket,key,options]); if (!error) stored.set(key,body); return { error }; },
    remove: async keys => { calls.push(['remove',bucket,keys]); keys.forEach(key => stored.delete(key)); return { error }; },
    createSignedUrl: async (key,ttl) => { calls.push(['sign',bucket,key,ttl]); return { error, data: error ? null : { signedUrl: `https://storage.example.test/signed/${bucket}/${key}?token=private-token` } }; },
  }) };
  globalThis.storageTest = { service: { storage, from }, session: { from, auth: { getUser: async () => ({ data: { user } }) } } };
  globalThis.fetch = async (url,options) => { calls.push(['fetch',url,options]); assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store'); return new Response(png, { status: options.headers?.Range ? rangeStatus : 200, headers: { 'content-type':'image/png', 'content-length':String(png.length), ...(options.headers?.Range && rangeStatus === 206 ? { 'content-range':'bytes 0-8/20' } : {}) } }); };
  return { calls, stored };
}

test('logos upload, read and delete through Supabase without a persistent public URL', async () => {
  const { calls, stored } = setup();
  const result = await assets.uploadBrandAsset({ companyId:company, slot:'primary_logo', file:new File([png],'My Logo.png',{type:'image/png'}) });
  assert.match(result.objectKey,new RegExp(`^companies/${company}/brand/primary_logo/`));
  assert.equal(result.publicUrl,null);
  assert.equal(calls[0][1],config.BRAND_ASSETS_BUCKET);
  assert.equal(calls[0][3].upsert,false);
  const response = await objects.downloadStorageObject(config.BRAND_ASSETS_BUCKET,result.objectKey);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
  assert.equal(calls.find(c => c[0] === 'sign')[3],60);
  await assets.deleteBrandAsset(result.objectKey);
  assert.equal(stored.size,0);
});

test('invalid or oversized files never reach storage', async () => {
  const { calls } = setup();
  for (const file of [new File(['<script>'],'fake.png',{type:'image/png'}), new File([png],'unsafe.svg',{type:'image/svg+xml'}), new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]) {
    await assert.rejects(assets.uploadBrandAsset({ companyId:company,slot:'primary_logo',file }));
    await assert.rejects(creative.uploadCreatorPreviewReference(company,file));
  }
  assert.equal(calls.length,0);
});

test('creator reference links use the private bucket and expire within one hour', async () => {
  const { calls } = setup();
  const reference = await creative.uploadCreatorPreviewReference(company,new File([png],'photo.png',{type:'image/png'}));
  assert.equal(reference.sha256.length,64);
  await creative.signedReferenceUrl(reference.key);
  assert.equal(calls[0][1],config.PRIVATE_MEDIA_BUCKET);
  assert.equal(calls[1][3],3600);
  await assert.rejects(creative.signedReferenceUrl('companies/other/brand/logo.png'));
  await assert.rejects(objects.signedStorageUrl(config.PRIVATE_MEDIA_BUCKET,reference.key,3601));
});

test('unsafe object paths and missing server credentials fail before any storage operation', async () => {
  const { calls } = setup();
  for (const key of ['../secret','folder/../secret','/secret','folder//secret','folder/%2e%2e/secret','https://evil.test/x']) await assert.rejects(objects.deleteStorageObject(config.BRAND_ASSETS_BUCKET,key), { code:'asset_key_invalid' });
  delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await assert.rejects(objects.downloadStorageObject(config.BRAND_ASSETS_BUCKET,'logo.png'), { code:'storage_not_configured' });
  assert.equal(calls.length,0);
});

test('provider errors and private URLs never leak in asset responses', async () => {
  setup({ error:{ code:'NoSuchBucket',message:'secret-key private-token' } });
  let caught;
  try { await objects.downloadStorageObject(config.BRAND_ASSETS_BUCKET,'logo.png'); } catch(error) { caught=error; }
  const response = objects.assetFailureResponse(caught);
  assert.equal(response.status,503);
  assert.equal(response.headers.get('x-storyloop-asset-error'),'storage_bucket_missing');
  assert.doesNotMatch(await response.text(),/secret-key|private-token/);
  const unknown = objects.assetFailureResponse(new Error('secret-key private-token'));
  assert.equal(unknown.status,502);
  assert.doesNotMatch(await unknown.text(),/secret-key|private-token/);
});

test('public logos read only the narrow platform view, and private logos are not publicly cached', async () => {
  let state = setup({ tables:{ storyloop_public_brand_assets:{primary_logo_key:'platform.png'}, company_brand_settings:{primary_logo_key:'tenant.png'} } });
  let response = await logoRoute.GET(new Request('https://app.test/api/brand/logo?public=1&key=private/other'));
  assert.equal(response.status,200);
  assert.equal(state.calls.find(c => c[0] === 'sign')[2],'platform.png');
  assert.match(response.headers.get('cache-control'),/^public/);
  assert.ok(!state.calls.some(c => c[0] === 'table' && c[1] === 'company_brand_settings'));
  response = await logoRoute.GET(new Request('https://app.test/api/brand/logo'));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  state = setup();
  assert.equal((await logoRoute.GET(new Request('https://app.test/api/brand/logo'))).status,404);
  assert.ok(!state.calls.some(c => c[0] === 'sign'));
});

test('campaign logos require a session, an RLS-visible row and matching company prefix', async () => {
  for (const [user,row,status] of [[null,null,401],[{},null,404],[{},{company_id:company,logo_key:'companies/another/brand/logo.png'},404]]) {
    const { calls }=setup({user,tables:{brand_campaigns:row}});
    assert.equal((await campaignRoute.GET(new Request('https://app.test'),{params:Promise.resolve({campaignId:jobId})})).status,status);
    assert.ok(!calls.some(c => c[0] === 'sign'));
  }
});

function mediaTables() { return {
  brand_preview_jobs:{ company_id:company, campaign_id:company, request_id:company, media_object_key:`private/brand-previews/${company}/${jobId}`,media_content_type:'video/mp4' },
  brand_preview_requests:{status:'approved',expires_at:new Date(Date.now()+60000).toISOString(),creative_id:company,creative_revision:1},
  brand_campaign_creatives:{approval_state:'approved',revision:1,plan_revision:1},
  brand_campaign_plans:{approval_state:'approved',revision:1},
}; }
const media = range => mediaRoute.GET(new Request('https://app.test/media',{headers:range?{range}:{}}),{params:Promise.resolve({jobId})});

test('preview access denies revoked/expired consent and stale approvals before storage', async () => {
  for (const change of [t=>t.brand_preview_requests.status='revoked',t=>t.brand_preview_requests.expires_at='2000-01-01',t=>t.brand_campaign_creatives.revision=2,t=>t.brand_campaign_plans.revision=2]) {
    const tables=mediaTables();change(tables);const {calls}=setup({tables});
    assert.equal((await media()).status,403);
    assert.ok(!calls.some(c=>c[0]==='sign'));
  }
});

test('video ranges stream with upstream status and private headers; signed URLs stay server-side', async () => {
  for (const rangeStatus of [206,200]) {
    const {calls}=setup({tables:mediaTables(),rangeStatus});
    const response=await media('bytes=0-8');
    assert.equal(response.status,rangeStatus);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('location'),null);
    assert.equal(calls.find(c=>c[0]==='fetch')[2].headers.Range,'bytes=0-8');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
    assert.equal((await media('bytes=0-4,6-8')).status,416);
  }
});
