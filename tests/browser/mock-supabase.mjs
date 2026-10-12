// Local-only deterministic browser fixtures; never imported by application code.
import http from 'node:http';
export const userId='10000000-0000-4000-8000-000000000001';
export const companyId='20000000-0000-4000-8000-000000000001';
export const campaignId='30000000-0000-4000-8000-000000000001';
const now=new Date().toISOString();
const user={id:userId,email:'brand@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:now,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:now};
const fixtures={
 brand_memberships:[{company_id:companyId,user_id:userId,role:'owner',status:'active',created_at:now}],
 companies:[{id:companyId,name:'Sample Brand',slug:'sample-brand'}],
 brand_campaigns:[{id:campaignId,company_id:companyId,created_by:userId,title:'Summer campaign',brand_name:'Sample Brand',website_url:'https://example.test',logo_key:null,promoted_item:'Everyday skincare',objective:'awareness',deliverables:['instagram_reel'],status:'draft',requested_budget_cents:25000000,created_at:now,updated_at:now,actual_live_at:null,completed_at:null}],
 brand_campaign_plans:[],brand_competitor_scans:[],brand_competitors:[],brand_competitor_observations:[],brand_competitor_products:[],
 brand_creator_catalog:[],brand_creator_rates:[],brand_campaign_creator_selections:[],brand_campaign_creatives:[],brand_campaign_metrics:[],brand_preview_requests:[],brand_preview_jobs:[],
 external_api_usage_events:[],storyloop_public_brand_assets:[],team_memberships:[],creator_accounts:[],
};
export function startMock(port=4545){return new Promise(resolve=>{const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify(user));return;}
 if(url.pathname==='/auth/v1/token'){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant',error_description:'Test credentials rejected'}));return;}
 if(url.pathname==='/auth/v1/logout'){res.end('{}');return;}
 if(url.pathname.startsWith('/rest/v1/rpc/')){res.end('[]');return;}
 const name=url.pathname.split('/').at(-1);let rows=structuredClone(fixtures[name]??[]);
 for(const [key,value]of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));if(value.startsWith('in.(')){const values=value.slice(4,-1).split(',').map(x=>x.replaceAll('"',''));rows=rows.filter(r=>values.includes(String(r[key])));}}
 if(req.method==='POST'&&name==='external_api_usage_events'){
  let body='';for await(const chunk of req)body+=chunk;const row={...JSON.parse(body),id:crypto.randomUUID()};fixtures.external_api_usage_events.push(row);rows=[row];res.statusCode=201;
 }
 if(req.method==='POST'&&name==='brand_campaigns'){
  let body='';for await(const chunk of req)body+=chunk;const incoming=JSON.parse(body);const row={...fixtures.brand_campaigns[0],...incoming,id:'30000000-0000-4000-8000-000000000002'};fixtures.brand_campaigns.unshift(row);rows=[row];res.statusCode=201;
 }
 res.setHeader('Content-Range',rows.length?`0-${rows.length-1}/${rows.length}`:'*/0');
 const object=(req.headers.accept??'').includes('application/vnd.pgrst.object+json');
 res.end(JSON.stringify(object?(rows[0]??null):rows));
 });server.listen(port,'127.0.0.1',()=>resolve(server));});}
export function sessionCookie(){const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const payload=Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),role:'authenticated'})).toString('base64url');
 return 'base64-'+Buffer.from(JSON.stringify({access_token:`${header}.${payload}.test-signature`,refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})).toString('base64url');}
if(process.argv[1]?.endsWith('mock-supabase.mjs')){await startMock();console.log('Fixture API running on4545');}
