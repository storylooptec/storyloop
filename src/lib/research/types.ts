import type { Tables, Json } from "@/types/database.types";

export type ResearchTask = {
  id: string; company_id: string; campaign_id: string; scan_id: string;
  kind: string; dedupe_key: string; dependencies: string[];
  payload: Record<string, unknown>; result: Record<string, unknown>;
  status: string; attempt_count: number; next_attempt_at: string;
  deadline_at: string; lease_token: string | null; lease_expires_at: string | null;
  error_code: string | null; created_at: string;
};
export type ResearchScan = Tables<"brand_competitor_scans"> & {
  stage: string; deadline_at: string; requests_used: number; cache_hits: number;
  payload: Record<string, unknown>; cache_from_scan_id: string | null; cache_expires_at: string | null;
};
export type ResearchCompetitor = Tables<"brand_competitors"> & {
  research_status: string; research_summary: Json;
};
export type ResearchObservation = Tables<"brand_competitor_observations">;

export const terminalTask = (status: string) => ["succeeded", "failed", "skipped", "uncertain"].includes(status);
