import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCreatorBrandLogoUrl() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("company_brand_settings")
    .select("primary_logo_key,dark_logo_key,light_logo_key")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const hasAnyLogo = Boolean(data.dark_logo_key) || Boolean(data.primary_logo_key) || Boolean(data.light_logo_key);
  return hasAnyLogo ? "/api/brand/logo?slot=primary" : null;
}
