import { researchDb } from "@/lib/research/db";
import { runResearchWorker } from "@/lib/research/worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Cron supplies a random, short-lived, one-use capability. No provider credentials cross this boundary. */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([0-9a-f]{64})$/i);
  if (!match) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const db = researchDb();
    const { data, error } = await db.rpc("consume_research_worker_nonce", { nonce: match[1] });
    if (error || data !== true) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json(await runResearchWorker(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[brand-research] Worker interrupted; persisted tasks await recovery");
    return Response.json({ error: "worker_interrupted" }, { status: 503 });
  }
}
