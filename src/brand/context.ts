import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type BrandContext = {
  userId: string;
  email: string | null;
  companyId: string;
  companyName: string;
  role: "owner" | "member";
};

export async function requireBrandContext(): Promise<BrandContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/brand?error=login");

  const { data: membership, error: membershipError } = await supabase
    .from("brand_memberships")
    .select("company_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) redirect("/brand?error=access");

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,name")
    .eq("id", membership.company_id)
    .single();

  if (companyError || !company) redirect("/brand?error=access");

  return {
    userId: user.id,
    email: user.email ?? null,
    companyId: company.id,
    companyName: company.name,
    role: membership.role === "owner" ? "owner" : "member",
  };
}
