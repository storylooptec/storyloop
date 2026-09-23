"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { logAuditEvent } from "@/audit/log-event";
import { requirePermission } from "@/auth/require-permission";
import {
  configurationKeys,
  type ConfigurationKey,
} from "@/configuration/definitions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isConfigurationKey(value: string): value is ConfigurationKey {
  return configurationKeys.includes(value as ConfigurationKey);
}

function parseValue(type: string, raw: string): string | number | boolean {
  if (type === "boolean") {
    if (raw !== "true" && raw !== "false") {
      throw new Error("Invalid boolean value");
    }
    return raw === "true";
  }

  if (type === "integer") {
    const value = Number(raw);
    if (!Number.isInteger(value)) throw new Error("Invalid integer value");
    return value;
  }

  if (type === "number") {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error("Invalid number value");
    return value;
  }

  return raw;
}

export async function saveConfigurationItem(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const key = String(formData.get("key") ?? "");
  const valueType = String(formData.get("valueType") ?? "");
  const isTbd = String(formData.get("isTbd") ?? "false") === "true";
  const rawValue = String(formData.get("value") ?? "");

  if (!isConfigurationKey(key)) {
    throw new Error("Unknown configuration key");
  }

  const value = isTbd ? null : parseValue(valueType, rawValue);
  const supabase = await createServerSupabaseClient();

  const { data: before } = await supabase
    .from("company_configuration")
    .select("value,is_tbd")
    .eq("company_id", context.companyId)
    .eq("key", key)
    .single();

  const { error } = await supabase
    .from("company_configuration")
    .update({
      value,
      is_tbd: isTbd,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("key", key);

  if (error) throw new Error("Unable to save configuration");

  await logAuditEvent({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "configuration.updated",
    entityType: "company_configuration",
    entityId: key,
    beforeState: before,
    afterState: { value, is_tbd: isTbd },
    isReversible: true,
    undoActionKey: "configuration.restore",
  });

  revalidatePath("/admin/settings/configuration");
  redirect("/admin/settings/configuration?saved=1");
}
