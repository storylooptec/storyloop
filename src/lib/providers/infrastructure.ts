import "server-only";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type InfrastructureContext = {
  provider: "supabase";
  operation: string;
  companyId: string;
  campaignId?: string | null;
  userId: string;
  inputUnits?: number;
  unitType?: string;
  telemetry?: "required" | "best_effort";
};

/** Callers authorize first. Best-effort telemetry is only for ordinary infrastructure writes, never paid-provider reservations. */
export async function trackInfrastructureOperation<T>(input: InfrastructureContext, work: () => Promise<T>): Promise<T> {
  let db: ReturnType<typeof createServiceSupabaseClient> | null = null;
  let eventId: string | null = null;
  try {
    db = createServiceSupabaseClient();
    const { data, error } = await db.from("external_api_usage_events").insert({
      provider_key: input.provider, operation: input.operation,
      company_id: input.companyId, campaign_id: input.campaignId ?? null,
      actor_user_id: input.userId, status: "started",
      input_units: input.inputUnits ?? 1, unit_type: input.unitType ?? "operation",
    }).select("id").single();
    if (error || !data) throw new Error("infrastructure_log_unavailable");
    eventId = data.id;
  } catch (error) {
    if (input.telemetry !== "best_effort") throw error;
    console.error("[infrastructure] Usage log unavailable", { operation: input.operation });
  }

  const started = Date.now();
  async function finish(status: "success" | "failed") {
    if (!db || !eventId) return;
    try {
      const { error } = await db.from("external_api_usage_events").update({
        status, failure_code: status === "failed" ? "operation_failed" : null,
        latency_ms: Date.now() - started, completed_at: new Date().toISOString(),
      }).eq("id", eventId);
      if (error) throw error;
    } catch {
      console.error("[infrastructure] Usage log finalization failed", { eventId });
    }
  }

  // Run once. A telemetry failure must never retry an already successful write.
  let result: T;
  try { result = await work(); }
  catch (error) { await finish("failed"); throw error; }
  await finish("success");
  return result;
}
