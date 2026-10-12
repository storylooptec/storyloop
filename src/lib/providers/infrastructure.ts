import "server-only";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type InfrastructureContext={provider:"r2"|"supabase";operation:string;companyId:string;campaignId?:string|null;userId:string;inputUnits?:number;unitType?:string};
/** Callers authorize the actor and resource first. Log logical writes, never secrets or private file URLs. */
export async function trackInfrastructureOperation<T>(input:InfrastructureContext,work:()=>Promise<T>):Promise<T>{
 const db=createServiceSupabaseClient();
 const {data:event,error}=await db.from('external_api_usage_events').insert({provider_key:input.provider,operation:input.operation,
  company_id:input.companyId,campaign_id:input.campaignId??null,actor_user_id:input.userId,status:'started',input_units:input.inputUnits??1,unit_type:input.unitType??'operation'}).select('id').single();
 if(error||!event)throw new Error('infrastructure_log_unavailable');
 const started=Date.now();let result:T;
 try{result=await work();}catch(cause){await db.from('external_api_usage_events').update({status:'failed',failure_code:'operation_failed',latency_ms:Date.now()-started,completed_at:new Date().toISOString()}).eq('id',event.id);throw cause;}
 const {error:finalError}=await db.from('external_api_usage_events').update({status:'success',latency_ms:Date.now()-started,completed_at:new Date().toISOString()}).eq('id',event.id);
 if(finalError)console.error('Storyloop infrastructure telemetry finalization failed',event.id); // IDs only; preserve a successful write.
 return result;
}
