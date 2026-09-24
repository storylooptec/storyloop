"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreatorAuthResult = {
  ok: boolean;
  message?: string;
  next?: string;
};

function validPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export async function requestCreatorOtp(phoneInput: string): Promise<CreatorAuthResult> {
  const phone = phoneInput.trim();

  if (!validPhone(phone)) {
    return { ok: false, message: "Enter a phone number with country code, for example +91…" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function verifyCreatorOtp(
  phoneInput: string,
  tokenInput: string,
  source = "creator_login",
): Promise<CreatorAuthResult> {
  const phone = phoneInput.trim();
  const token = tokenInput.trim();

  if (!validPhone(phone) || !/^\d{6}$/.test(token)) {
    return { ok: false, message: "Check the phone number and six-digit OTP." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });

  if (error) {
    const lower = error.message.toLowerCase();
    return {
      ok: false,
      message: lower.includes("expired")
        ? "That OTP has expired. Request a new one."
        : "That OTP is invalid or no longer usable.",
    };
  }

  const { error: bootstrapError } = await supabase.rpc("ensure_creator_account", {
    p_phone: phone,
    p_source: source,
  });

  if (bootstrapError) {
    return { ok: false, message: "Signed in, but Creator setup could not start. Try again." };
  }

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("onboarding_completed")
    .maybeSingle();

  return {
    ok: true,
    next: account?.onboarding_completed ? "/creator" : "/creator/onboarding",
  };
}
