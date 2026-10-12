"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { brandRegistrationError, brandRegistrationRedirect } from "@/brand/registration";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireBrandMembership() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    redirect("/brand?error=credentials");
  }

  const { data: membership, error } = await supabase
    .from("brand_memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) redirect("/brand?error=access");
  if (!membership) redirect("/brand/setup");

  redirect("/brand/home");
}

export async function signInBrandAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!validEmail(email) || password.length < 1) {
    redirect("/brand?error=missing");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect("/brand?error=credentials");
  await requireBrandMembership();
}

export async function sendBrandEmailCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!validEmail(email)) redirect("/brand?error=missing");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) redirect("/brand?error=code");
  redirect(`/brand/verify?email=${encodeURIComponent(email)}&sent=1`);
}

export async function verifyBrandEmailCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");

  if (!validEmail(email) || !/^\d{6}$/.test(token)) {
    redirect(`/brand/verify?email=${encodeURIComponent(email)}&error=code`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    redirect(`/brand/verify?email=${encodeURIComponent(email)}&error=code`);
  }

  await requireBrandMembership();
}

export async function signOutBrandAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/brand");
}

export async function registerBrandAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!validEmail(email) || email.length > 254 || password.length < 6 || password.length > 128) {
    redirect("/brand/register?error=details");
  }
  const emailRedirectTo = brandRegistrationRedirect(process.env, (await headers()).get("origin"));
  if (!emailRedirectTo) {
    console.error("[brand-registration] No trusted confirmation URL for this request.");
    redirect("/brand/register?error=configuration");
  }
  const db = await createServerSupabaseClient();
  const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo } });
  if (error) {
    // Keep credentials, addresses and raw provider responses out of logs and URLs.
    console.error("[brand-registration] Auth signup failed", { code: error.code ?? "unknown", status: error.status });
    redirect(`/brand/register?error=${brandRegistrationError(error)}`);
  }
  if (data.session) redirect("/brand/setup");
  redirect("/brand/register?sent=1");
}
export async function createBrandWorkspaceAction(formData:FormData) {
  const name=String(formData.get("workspace_name")??"").trim();
  const db=await createServerSupabaseClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect("/brand?error=login");
  if(name.length<2||name.length>120)redirect("/brand/setup?error=name");
  const {error}=await db.rpc("create_brand_workspace",{workspace_name:name});
  if(error)redirect("/brand/setup?error=create");
  redirect("/brand/campaigns/new");
}
