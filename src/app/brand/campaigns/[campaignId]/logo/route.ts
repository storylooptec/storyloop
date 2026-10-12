import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BRAND_ASSETS_BUCKET } from "@/lib/storage/config";
import { downloadStorageObject, assetFailureResponse } from "@/lib/storage/objects";
export async function GET(_request:Request,{params}:{params:Promise<{campaignId:string}>}){
  const {campaignId}=await params; const db=await createServerSupabaseClient();
  const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401});
  const {data:campaign}=await db.from('brand_campaigns').select('logo_key,company_id').eq('id',campaignId).maybeSingle();
  if(!campaign?.logo_key || !campaign.logo_key.startsWith(`companies/${campaign.company_id}/brand/`)) return new Response('Not found',{status:404});
  try {
    const result = await downloadStorageObject(BRAND_ASSETS_BUCKET, campaign.logo_key);
    return new Response(result.body, { headers: {
      "Content-Type": result.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return assetFailureResponse(error); }
}
