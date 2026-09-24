import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreatorCmsMap = Record<string, string>;

export async function getCreatorCmsContent(): Promise<CreatorCmsMap> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("creator_cms_content")
    .select("content_key,value,is_active")
    .eq("is_active", true);

  return Object.fromEntries((data ?? []).map((row) => [row.content_key, row.value]));
}
