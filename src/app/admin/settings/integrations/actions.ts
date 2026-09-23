"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IntegrationState } from "@/integrations/types";

const allowedStates: IntegrationState[] = [
  "disconnected",
  "mock",
  "sandbox",
  "live",
  "error",
];

export async function saveIntegrationState(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const providerKey = String(formData.get("providerKey") ?? "");
  const state = String(formData.get("state") ?? "") as IntegrationState;

  if (!providerKey || !allowedStates.includes(state)) {
    throw new Error("Invalid integration update");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("company_integrations")
    .update({
      state,
      status_message: state === "error" ? "Provider requires attention." : null,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("provider_key", providerKey);

  if (error) throw new Error("Unable to update integration state");

  revalidatePath("/admin/settings/integrations");
  redirect("/admin/settings/integrations?saved=1");
}
