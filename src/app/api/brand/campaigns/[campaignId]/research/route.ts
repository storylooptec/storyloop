import { createServerSupabaseClient } from "@/lib/supabase/server";
import { researchDb } from "@/lib/research/db";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Reads saved work only. This endpoint never enqueues tasks or contacts a paid provider. */
export async function GET(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const scanId = new URL(request.url).searchParams.get("scan");
  if (!uuid.test(campaignId) || scanId && !uuid.test(scanId)) return reply({ error: "invalid_request" }, 400);
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return reply({ error: "login_required" }, 401);
  const { data: campaign, error: accessError } = await auth.from("brand_campaigns").select("id,company_id").eq("id", campaignId).maybeSingle();
  if (accessError || !campaign) return reply({ error: "not_found" }, 404);
  try {
    const db = researchDb();
    let query = db.from("brand_competitor_scans")
      .select("id,company_id,campaign_id,status,stage,result_count,error_code,created_at,started_at,completed_at,deadline_at,requests_used,cache_hits")
      .eq("company_id", campaign.company_id).eq("campaign_id", campaignId);
    if (scanId) query = query.eq("id", scanId);
    const { data: scan, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!scan) return reply({ scan: null, competitors: [], observations: [], tasks: [] });
    const results = await Promise.all([
      db.from("brand_competitors").select("*").eq("company_id", campaign.company_id).eq("scan_id", scan.id).order("created_at"),
      db.from("brand_competitor_observations").select("*").eq("company_id", campaign.company_id).eq("scan_id", scan.id).order("observed_at"),
      db.from("brand_research_tasks").select("id,kind,status,error_code,next_attempt_at").eq("company_id", campaign.company_id).eq("scan_id", scan.id).order("created_at"),
    ]);
    if (results.some(result => result.error)) throw new Error("read_failed");
    return reply({ scan, competitors: results[0].data ?? [], observations: results[1].data ?? [], tasks: results[2].data ?? [] });
  } catch { return reply({ error: "research_unavailable" }, 503); }
}
