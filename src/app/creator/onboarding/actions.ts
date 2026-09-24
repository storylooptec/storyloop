"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export async function saveCreatorOnboardingStep(step: number, patch: Record<string, Json>) {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { ok: false, message: "Sign in is required before this step can be saved." };

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("creator_id,onboarding_data")
    .eq("user_id", userId)
    .single();

  if (!account) return { ok: false, message: "Creator account is unavailable." };

  const current =
    account.onboarding_data && typeof account.onboarding_data === "object" && !Array.isArray(account.onboarding_data)
      ? account.onboarding_data
      : {};

  const { error } = await supabase
    .from("creator_accounts")
    .update({
      onboarding_step: Math.max(1, Math.min(9, step)),
      onboarding_data: { ...current, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function savePrimaryCreatorProfile(profileUrl: string, handle: string | null) {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { ok: false, message: "Sign in required." };

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("creator_id")
    .eq("user_id", userId)
    .single();

  if (!account) return { ok: false, message: "Creator account unavailable." };

  await supabase
    .from("creator_social_accounts")
    .upsert({
      creator_id: account.creator_id,
      profile_url: profileUrl,
      handle,
      is_primary: true,
      verification_status: "unverified_provider_pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "creator_id,profile_url" });

  await supabase
    .from("creators")
    .update({ primary_handle: handle, updated_at: new Date().toISOString() })
    .eq("id", account.creator_id);

  return { ok: true };
}

export async function completeCreatorOnboardingPreview(data: Record<string, Json>) {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { ok: false, message: "Sign in required." };

  const { data: config } = await supabase.rpc("get_creator_configuration");
  const age = (config ?? []).find((item) => item.key === "creator_age_verification_method");

  if (!age || age.is_tbd) {
    return { ok: false, message: "O4 age verification method is still TBD. Live listing cannot complete yet." };
  }

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("onboarding_data")
    .eq("user_id", userId)
    .single();

  const current =
    account?.onboarding_data && typeof account.onboarding_data === "object" && !Array.isArray(account.onboarding_data)
      ? account.onboarding_data
      : {};

  await supabase
    .from("creator_accounts")
    .update({ onboarding_data: { ...current, ...data }, onboarding_step: 9 })
    .eq("user_id", userId);

  const { error } = await supabase.rpc("complete_creator_onboarding");
  return error ? { ok: false, message: error.message } : { ok: true };
}
