// Deterministic local-only research fixtures. No paid provider is contacted.
import http from 'node:http';
import { startMock, sessionCookie, campaignId, companyId, userId } from './mock-supabase.mjs';
export { sessionCookie, campaignId };
const now='2026-10-12T23:30:00.000Z';
export const scanId='40000000-0000-4000-8000-000000000001';
const competitorId=index=>`50000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const evidenceId=index=>`60000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
export const researchState={phase:'empty',readOnly:false,enqueues:0,selections:[],reads:0};
const campaign={id:campaignId,company_id:companyId,created_by:userId,title:'Local research fixture',brand_name:'Fixture Brand',website_url:'https://example.test',promoted_item:'Everyday skincare',objective:'awareness',deliverables:['instagram_reel'],status:'draft',requested_budget_cents:25000000,created_at:now,updated_at:now,actual_live_at:null,completed_at:null};
const finished=()=>['complete','partial'].includes(researchState.phase);
function scan(){return {id:scanId,company_id:companyId,campaign_id:campaignId,provider_key:'searchapi',query_hash:'fixture',market:'IN',status:finished()?'succeeded':researchState.phase==='queued'?'queued':'running',stage:finished()?'complete':researchState.phase==='queued'?'queued':'evidence',result_count:finished()?researchState.phase==='partial'?2:5:0,error_code:researchState.phase==='partial'?'partial_evidence':null,created_by:userId,created_at:now,started_at:researchState.phase==='queued'?null:now,completed_at:finished()?now:null,deadline_at:'2099-01-01T00:00:00Z',requests_used:finished()?12:2,cache_hits:0};}
function competitors(){return Array.from({length:researchState.phase==='partial'?2:5},(_,i)=>{const id=competitorId(i+1);return {id,company_id:companyId,campaign_id:campaignId,scan_id:scanId,name:`Fixture competitor ${i+1}`,official_domain:`competitor${i+1}.example.test`,rationale:'Competes in the same product category and target market; supported by saved website evidence.',status:researchState.selections.includes(id)?'confirmed':'candidate',evidence_ids:[evidenceId(i*4+1)],verified_at:now,confirmed_at:null,enrichment_status:'succeeded',enrichment_started_at:now,enriched_at:now,error_code:null,created_at:now,updated_at:now,research_status:'succeeded',research_summary:{product_price:'Daily cleanser · ₹450 listing observed',campaign:'Product education with a creator demonstration',social:'Short routines and product demonstrations',sentiment:i===4?'': 'Mixed: ease of use praised; fragrance questioned',sentiment_sample_size:i===4?0:4}};});}
function observations(){return competitors().flatMap((competitor,i)=>['official_site','meta_ad','social_post','social_comment'].filter(kind=>i!==4||kind!=='social_comment').map((kind,j)=>({id:evidenceId(i*4+j+1),company_id:companyId,scan_id:scanId,competitor_id:competitor.id,competitor_name:competitor.name,competitor_domain:competitor.official_domain,evidence_kind:kind,source_record_key:`${i}-${kind}`,source_url:i===3&&kind==='meta_ad'?'javascript:alert(1)':`https://${competitor.official_domain}/evidence/${kind}`,source_domain:competitor.official_domain,source_title:kind==='meta_ad'?'Creator product demonstration':kind==='social_comment'?'Public comment sample':kind==='social_post'?'Product routine post':'Official product range',source_snippet:kind==='social_comment'?'Easy to use, but I would prefer a fragrance-free option.':'Saved fixture evidence for a product demonstration and product range.',published_at:null,source_date_text:kind==='meta_ad'?'12 Oct 2026':null,observed_at:now,created_at:now,content_hash:'fixture',provider_search_id:'fixture',attributes:{platform:kind==='meta_ad'?'Instagram':undefined}})));}
function tasks(){return ['discovery','extract','verify','meta_ads','google_ads','instagram_profile','instagram_comments','products','summarize'].map((kind,i)=>({id:`70000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,company_id:companyId,scan_id:scanId,kind,status:finished()?(researchState.phase==='partial'&&kind==='instagram_comments'?'failed':'succeeded'):researchState.phase==='queued'?'queued':i<3?'succeeded':kind==='meta_ads'?'running':'queued',error_code:null,next_attempt_at:null,created_at:now}));}
function filtered(rows,url){for(const [key,value] of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));if(value.startsWith('in.(')){const values=value.slice(4,-1).split(',').map(v=>v.replaceAll('"',''));rows=rows.filter(row=>values.includes(String(row[key])));}}return url.searchParams.has('limit')?rows.slice(0,Number(url.searchParams.get('limit'))):rows;}
export async function startResearchFixture(){
 const base=await startMock(4546);
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4545');
  res.setHeader('Content-Type','application/json');res.setHeader('X-Supabase-Api-Version','2024-01-01');
  const name=url.pathname.split('/').at(-1);
  if(url.pathname==='/rest/v1/rpc/enqueue_research_scan'){
   researchState.enqueues++;researchState.phase='queued';
   await new Promise(resolve=>setTimeout(resolve,250));
   res.end(JSON.stringify({scan_id:scanId,disposition:'created'}));return;
  }
  if(url.pathname==='/rest/v1/rpc/select_research_competitors'){
   let body='';for await(const chunk of req)body+=chunk;
   researchState.selections=JSON.parse(body).selected_ids;
   res.end('{}');return;
  }
  let rows;
  if(name==='brand_campaigns')rows=[{...campaign,status:researchState.readOnly?'active':'draft'}];
  if(name==='brand_competitor_scans')rows=researchState.phase==='empty'?[]:[scan()];
  if(name==='brand_competitors')rows=finished()?competitors():[];
  if(name==='brand_competitor_observations')rows=finished()?observations():[];
  if(name==='brand_research_tasks')rows=researchState.phase==='empty'?[]:tasks();
  if(rows){
   researchState.reads++;rows=filtered(rows,url);
   // Query hash matching is handled by the real enqueue RPC in production. This fixture returns the existing job for dedupe reads.
   if(name==='brand_competitor_scans'&&url.searchParams.has('query_hash')&&researchState.phase!=='empty')rows=[scan()];
   res.setHeader('Content-Range',rows.length?`0-${rows.length-1}/${rows.length}`:'*/0');
   res.end(JSON.stringify((req.headers.accept??'').includes('application/vnd.pgrst.object+json')?(rows[0]??null):rows));return;
  }
  let body='';for await(const chunk of req)body+=chunk;
  const upstream=await fetch(`http://127.0.0.1:4546${req.url}`,{method:req.method,headers:{...req.headers,host:'127.0.0.1:4546'},...(body?{body}:{} )});
  res.statusCode=upstream.status;for(const [key,value]of upstream.headers)if(!['content-length','content-encoding','transfer-encoding'].includes(key))res.setHeader(key,value);
  res.end(await upstream.text());
 });
 await new Promise(resolve=>server.listen(4545,'127.0.0.1',resolve));
 return {close:()=>Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>base.close(resolve))])};
}
