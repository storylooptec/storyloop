"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/audit/log-event";
import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { isIsoDate, isUuid } from "@/brand/reporting";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

function amount(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  return /^\d+(?:\.\d{1,2})?$/.test(raw) && Number.isFinite(Number(raw)) && Number(raw) <= 1_000_000_000 ? Number(raw) : null;
}
function result(code: string): never { redirect(`/admin/settings/api-health?bill=${code}#provider-billing`); }
async function financeContext() {
  const context = await requirePermission(permissions.financialActionsPerform);
  const session = await createServerSupabaseClient();
  const { data } = await session.from("companies").select("id").eq("id",context.companyId).eq("slug","storyloop").maybeSingle();
  if (!data) redirect("/admin/unauthorized");
  return context;
}

export async function recordProviderInvoiceAction(form: FormData) {
  const context = await financeContext();
  const provider = String(form.get("provider_key") ?? "");
  const reference = String(form.get("invoice_reference") ?? "").trim();
  const billedAt = String(form.get("billed_at") ?? "");
  const periodStart = String(form.get("period_start") ?? "");
  const periodEnd = String(form.get("period_end") ?? "");
  const cost = amount(form.get("amount_usd"));
  if (!["serpapi","openai","higgsfield","r2","supabase"].includes(provider) || reference.length < 3 || reference.length > 180 || cost === null || !isIsoDate(billedAt) || billedAt > new Date().toISOString().slice(0,10) || !isIsoDate(periodStart) || !isIsoDate(periodEnd) || periodEnd < periodStart || form.get("native_usd_verified") !== "on") result("invalid");
  const service = createServiceSupabaseClient();
  const record = { provider_key:provider,invoice_reference:reference,amount_usd:cost,currency:"USD",billed_at:billedAt,period_start:periodStart,period_end:periodEnd,recorded_by:context.userId };
  const { data,error } = await service.from("external_api_bills").insert(record).select("id").single();
  if (error) result(error.code === "23505" ? "duplicate" : "failed");
  await logAuditEvent({ companyId:context.companyId,actorUserId:context.userId,action:"api_invoice.recorded",entityType:"external_api_bill",entityId:data.id,afterState:record,metadata:{verification:"provider_invoice_native_usd"} });
  revalidatePath("/admin/settings/api-health");
  result("saved");
}

export async function correctProviderInvoiceAction(form: FormData) {
  const context = await financeContext();
  const id = String(form.get("bill_id") ?? "");
  const originalAmount = amount(form.get("original_amount_usd"));
  const correctedAmount = amount(form.get("amount_usd"));
  const reason = String(form.get("correction_reason") ?? "").trim();
  if (!isUuid(id) || originalAmount === null || correctedAmount === null || reason.length < 10 || reason.length > 500 || form.get("native_usd_verified") !== "on") result("invalid");
  const service = createServiceSupabaseClient();
  const {data:before,error:readError} = await service.from("external_api_bills").select("*").eq("id",id).maybeSingle();
  if (readError || !before) result("failed");
  if (Number(before.amount_usd) !== originalAmount) result("conflict");
  const update = {amount_usd:correctedAmount,recorded_by:context.userId,updated_at:new Date().toISOString()};
  const {data:updated,error} = await service.from("external_api_bills").update(update).eq("id",id).eq("amount_usd",originalAmount).eq("updated_at",before.updated_at).select("id").maybeSingle();
  if (error || !updated) result("conflict");
  await logAuditEvent({ companyId:context.companyId,actorUserId:context.userId,action:"api_invoice.corrected",entityType:"external_api_bill",entityId:id,beforeState:before,afterState:update,metadata:{correction_reason:reason,verification:"provider_invoice_native_usd"} });
  revalidatePath("/admin/settings/api-health");
  result("corrected");
}
