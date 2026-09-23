"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  templateKeys,
  type TemplateKey,
} from "@/templates/definitions";

function isTemplateKey(value: string): value is TemplateKey {
  return templateKeys.includes(value as TemplateKey);
}

function parseVariables(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function saveTemplate(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const key = String(formData.get("templateKey") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const variables = parseVariables(String(formData.get("variables") ?? ""));
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!isTemplateKey(key)) {
    throw new Error("Unknown template key");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("company_templates")
    .update({
      subject: subject || null,
      body,
      variables,
      is_active: isActive,
      requires_human_review: true,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("template_key", key);

  if (error) throw new Error("Unable to save template");

  revalidatePath("/admin/settings/templates");
  redirect("/admin/settings/templates?saved=1");
}
