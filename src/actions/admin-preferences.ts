"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function completeAdminOnboarding() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("admin_user_preferences").upsert(
    {
      company_id: context.companyId,
      user_id: context.userId,
      admin_onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,user_id" },
  );

  if (error) {
    throw new Error("Unable to save Admin onboarding preference");
  }

  revalidatePath("/admin", "layout");
}
