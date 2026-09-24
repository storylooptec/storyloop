import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type CreatorTier = "free" | "paid" | "exclusive";

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getCreatorContext() {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("user_id,creator_id,company_id,phone,tier,onboarding_step,onboarding_completed,onboarding_data,preferences,entitlement_state")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return { userId, account: null, creator: null };

  const { data: creator } = await supabase
    .from("creators")
    .select("id,display_name,primary_handle,metadata")
    .eq("id", account.creator_id)
    .maybeSingle();

  return {
    userId,
    account: {
      ...account,
      tier: (["free", "paid", "exclusive"].includes(account.tier)
        ? account.tier
        : "free") as CreatorTier,
      onboardingData: asRecord(account.onboarding_data),
      preferences: asRecord(account.preferences),
      entitlementState: asRecord(account.entitlement_state),
    },
    creator,
  };
}

export async function requireCreatorContext() {
  const context = await getCreatorContext();

  if (!context) redirect("/creator/login");
  if (!context.account) redirect("/creator/onboarding");
  if (!context.account.onboarding_completed) redirect("/creator/onboarding");

  return context as typeof context & { account: NonNullable<typeof context.account> };
}
