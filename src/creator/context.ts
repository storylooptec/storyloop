import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { creatorDemoCookies, getCreatorAuthMode } from "@/creator/auth-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type CreatorTier = "free" | "paid" | "exclusive";

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getCreatorContext() {
  if (getCreatorAuthMode() === "demo") {
    const store = await cookies();
    if (store.get(creatorDemoCookies.session)?.value === "1") {
      const onboarded = store.get(creatorDemoCookies.onboarded)?.value === "1";
      const handle = store.get(creatorDemoCookies.handle)?.value ?? null;
      const phone = store.get(creatorDemoCookies.phone)?.value ?? null;

      return {
        userId: "demo-user",
        demoMode: true,
        account: {
          user_id: "demo-user",
          creator_id: "00000000-0000-0000-0000-000000000001",
          company_id: "demo-company",
          phone,
          tier: "free" as CreatorTier,
          onboarding_step: onboarded ? 9 : 1,
          onboarding_completed: onboarded,
          onboardingData: {},
          preferences: {},
          entitlementState: {},
        },
        creator: {
          id: "00000000-0000-0000-0000-000000000001",
          display_name: null,
          primary_handle: handle,
          metadata: {},
        },
      };
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("user_id,creator_id,company_id,phone,tier,onboarding_step,onboarding_completed,onboarding_data,preferences,entitlement_state")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return { userId, demoMode: false, account: null, creator: null };

  const { data: creator } = await supabase
    .from("creators")
    .select("id,display_name,primary_handle,metadata")
    .eq("id", account.creator_id)
    .maybeSingle();

  return {
    userId,
    demoMode: false,
    account: {
      ...account,
      tier: (["free", "paid", "exclusive"].includes(account.tier) ? account.tier : "free") as CreatorTier,
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
