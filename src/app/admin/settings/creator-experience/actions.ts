"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAuditEvent } from "@/audit/log-event";
import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveCreatorCmsItem(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";
  const supabase = await createServerSupabaseClient();

  const { data: before } = await supabase
    .from("creator_cms_content")
    .select("value,is_active")
    .eq("company_id", context.companyId)
    .eq("content_key", key)
    .single();

  const { error } = await supabase
    .from("creator_cms_content")
    .update({
      value,
      is_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("content_key", key);

  if (error) throw new Error("Unable to save Creator Experience content");

  await logAuditEvent({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "creator_cms.updated",
    entityType: "creator_cms_content",
    entityId: key,
    beforeState: before,
    afterState: { value, is_active: active },
    isReversible: true,
    undoActionKey: "creator_cms.restore",
  });

  revalidatePath("/admin/settings/creator-experience");
  revalidatePath("/creator");
  redirect("/admin/settings/creator-experience?saved=1");
}
