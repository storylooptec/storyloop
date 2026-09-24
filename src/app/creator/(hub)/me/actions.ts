"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { creatorDemoCookies, getCreatorAuthMode } from "@/creator/auth-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function creatorSignOut() {
  if (getCreatorAuthMode() === "demo") {
    const store = await cookies();
    store.delete(creatorDemoCookies.session);
    store.delete(creatorDemoCookies.phone);
    store.delete(creatorDemoCookies.onboarded);
    store.delete(creatorDemoCookies.handle);
    redirect("/creator/login");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/creator/login");
}
