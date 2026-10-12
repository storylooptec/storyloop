import Link from "next/link";
import Image from "next/image";
import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";
function resume(id:string,status:string){return status==='active'||status==='completed'?`/brand/reports?campaign=${id}`:status==='ready_for_desk'?`/brand/create?campaign=${id}`:status==='planning'?`/brand/plan?campaign=${id}`:`/brand/campaigns/${id}/competitors`;}
export default async function BrandHomePage(){
 const context=await requireBrandContext();const db=await createServerSupabaseClient();
 const [{data:campaigns,error},{data:scans},{data:plans}]=await Promise.all([
   db.from('brand_campaigns').select('id,title,brand_name,logo_key,status,updated_at').eq('company_id',context.companyId).order('updated_at',{ascending:false}).limit(50),
   db.from('brand_competitor_scans').select('id,campaign_id,completed_at,result_count').eq('company_id',context.companyId).eq('status','succeeded').order('completed_at',{ascending:false}).limit(1),
   db.from('brand_campaign_plans').select('campaign_id,brief,approval_state,updated_at').eq('company_id',context.companyId).order('updated_at',{ascending:false}).limit(1),
 ]);
 const latest=campaigns?.[0];const plan=plans?.[0];const brief=plan?.brief&&typeof plan.brief==='object'&&!Array.isArray(plan.brief)?plan.brief:null;
 const scan=scans?.[0];
 return <BrandShell active="Home" companyName={context.companyName} email={context.email}>
 <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}><div><p className={styles.eyebrow}>Your brand workspace</p><h1 className={styles.appTitle}>{latest?'Pick up where you left off':'Your next campaign starts here'}</h1><p className={styles.appCopy}>From a market question to an approved campaign, with the evidence behind every decision.</p></div><Link href="/brand/campaigns/new" className={styles.primaryButton}>+ New campaign</Link></header>
 {error?<p className={styles.error}>Your campaigns could not be loaded. Please reload.</p>:null}
 <section className={styles.homeGrid}><article className={styles.panel}><p className={styles.eyebrow}>{plan?'Latest campaign brief':'Start with your brand'}</p>
 <h2 style={{fontSize:22,marginTop:0}}>{(plan?campaigns?.find(c=>c.id===plan.campaign_id)?.title:latest?.title)??'What are you planning to launch?'}</h2>
 <p className={styles.appCopy}>{typeof brief?.summary==='string'?brief.summary:'Add your brand, campaign objective and deliverables. Then scan the competition and shape a brief you can edit and approve.'}</p>
 <Link href={plan?`/brand/plan?campaign=${plan.campaign_id}`:latest?resume(latest.id,latest.status):'/brand/campaigns/new'} className={styles.primaryButton} style={{marginTop:20}}>{plan?'Review your brief':latest?'Continue campaign':'Start your first campaign'} →</Link></article>
 <article className={styles.panel}><p className={styles.eyebrow}>Market evidence</p><h2 style={{fontSize:20,marginTop:0}}>{scan?'Your latest scan is saved':'Build your first market view'}</h2>
 <p className={styles.muted}>{scan?`Observed ${new Date(scan.completed_at??'').toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}. Review sources and confirm the brands you compete with.`:'Every scan keeps dated sources, so you can see what was observed and what changed later.'}</p>
 {scan?<Link href={`/brand/campaigns/${scan.campaign_id}/competitors`} className={styles.secondaryButton}>Review competition</Link>:null}
 </article></section>
 <section className={styles.panel} style={{marginTop:20}}><p className={styles.eyebrow}>Campaigns</p><h2 style={{margin:0,fontSize:20}}>Your campaign room</h2>
 {campaigns?.length?<div className={styles.campaignList}>{campaigns.map(c=><article className={styles.campaignRow} key={c.id}>
 <div style={{display:'flex',alignItems:'center',gap:12}}>{c.logo_key?<Image unoptimized src={`/brand/campaigns/${c.id}/logo`} alt={`${c.brand_name} logo`} width={40} height={40} style={{objectFit:'contain',borderRadius:8}}/>:null}<div><Link href={resume(c.id,c.status)}><strong>{c.title}</strong></Link><div className={styles.muted}>{c.brand_name} · Updated {new Date(c.updated_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</div></div></div>
 <div style={{display:'flex',alignItems:'center',gap:12}}><span className={styles.statusPill}>{c.status.replaceAll('_',' ')}</span><Link href={`/brand/campaigns/${c.id}/manage`} className={styles.textButton}>Workspace →</Link></div>
 </article>)}</div>:<div className={styles.emptyState}>Your first campaign will appear here. You can save a draft and return whenever you are ready.</div>}
 </section></BrandShell>;
}
