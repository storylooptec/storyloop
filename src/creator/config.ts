import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type CreatorConfigItem = {
  key: string;
  label: string;
  value: Json;
  is_tbd: boolean;
};

export async function getCreatorConfiguration() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("get_creator_configuration");
  return (data ?? []) as CreatorConfigItem[];
}

export function configByKey(items: CreatorConfigItem[], key: string) {
  return items.find((item) => item.key === key);
}
