import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Research RPCs have their own migration contract. Call only after authorization. */
export function researchDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("trusted_database_not_configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function searchApiKey() {
  return (process.env.SEARCHAPI_API_KEY || process.env.SEARCHAPI_KEY || process.env.SEARCH_API_KEY || "").trim();
}

export function researchConfigurationError(): string | null {
  if (process.env.SEARCHAPI_ENABLED === "false") return "provider_disabled";
  if (!searchApiKey() || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_ENABLED === "false") return "provider_not_configured";
  const model = process.env.OPENAI_BRIEF_MODEL || "gpt-4.1-mini";
  if (!["gpt-4.1-mini", "gpt-4.1-mini-2025-04-14"].includes(model) && (!process.env.OPENAI_INPUT_COST_PER_1M_USD || !process.env.OPENAI_OUTPUT_COST_PER_1M_USD)) return "cost_estimate_required";
  return null;
}
