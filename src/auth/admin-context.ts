import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/auth/permissions";

export type AdminContext = {
  userId: string;
  email: string | null;
  companyId: string;
  role: TeamRole;
};

export async function requireAdminContext(): Promise<AdminContext> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: membership, error } = await supabase
    .from("team_memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    redirect("/admin/unauthorized");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    companyId: membership.company_id,
    role: membership.role,
  };
}
