"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/audit/log-event";
import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { isUuid } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function reconcileApiUsageAction(formData: FormData) {
  const context = await requirePermission(permissions.financialActionsPerform);
  // A privileged database client must never rely on a role name without the Storyloop tenant check.
  const session = await createServerSupabaseClient();
  const { data: operatorCompany } = await session.from("companies").select("id").eq("id", context.companyId).eq("slug", "storyloop").maybeSingle();
  if (!operatorCompany) redirect("/admin/unauthorized");
  const eventId = String(formData.get("event_id") ?? "");
  const rawCost = String(formData.get("billed_cost_usd") ?? "").trim();
  const reference = String(formData.get("billing_reference") ?? "").trim();
  if (!isUuid(eventId) || !/^\d+(?:\.\d{1,6})?$/.test(rawCost) || !Number.isFinite(Number(rawCost)) || Number(rawCost) > 999999 || reference.length < 3 || reference.length > 500 || formData.get("verified") !== "on") redirect("/admin/settings/api-health?error=reconcile");
  const service = createServiceSupabaseClient();
  const { data: before } = await service.from("external_api_usage_events").select("id,status,billed_cost_usd,billed_cost_verified,billing_reference,reconciled_at").eq("id", eventId).maybeSingle();
  if (!before || before.status === "started") redirect("/admin/settings/api-health?error=reconcile");
  const update = { billed_cost_usd: Number(rawCost), billed_cost_verified: true, billing_reference: reference, reconciled_at: new Date().toISOString() };
  const { data: updated, error } = await service.from("external_api_usage_events").update(update).eq("id", eventId).neq("status", "started").select("id").maybeSingle();
  if (error || !updated) redirect("/admin/settings/api-health?error=reconcile");
  await logAuditEvent({ companyId: context.companyId, actorUserId: context.userId, action: "api_usage.billing_reconciled", entityType: "external_api_usage_event", entityId: eventId, beforeState: before, afterState: update, metadata: { method: "manual_provider_invoice", costs_currency: "USD" } });
  revalidatePath("/admin/settings/api-health");
  redirect("/admin/settings/api-health?saved=1");
}
