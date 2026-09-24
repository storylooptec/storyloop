"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function creatorSignOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/creator/login");
}
