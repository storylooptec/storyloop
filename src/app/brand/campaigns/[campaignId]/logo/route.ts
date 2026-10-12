import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getR2Client } from "@/lib/r2/client";
import { getR2Config } from "@/lib/r2/config";
export async function GET(_request:Request,{params}:{params:Promise<{campaignId:string}>}){
  const {campaignId}=await params; const db=await createServerSupabaseClient();
  const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401});
  const {data:campaign}=await db.from('brand_campaigns').select('logo_key,company_id').eq('id',campaignId).maybeSingle();
  if(!campaign?.logo_key || !campaign.logo_key.startsWith(`companies/${campaign.company_id}/brand/`)) return new Response('Not found',{status:404});
  try{const result=await getR2Client().send(new GetObjectCommand({Bucket:getR2Config().bucket,Key:campaign.logo_key}));
    if(!result.Body)return new Response('Not found',{status:404});
    return new Response(Uint8Array.from(await result.Body.transformToByteArray()).buffer,{headers:{'Content-Type':result.ContentType??'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Logo unavailable',{status:404});}
}
