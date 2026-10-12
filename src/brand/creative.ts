import { createHash } from "node:crypto";

export type CampaignConcept = { angle: string; hook: string; script: string; cta: string; format: string };
export type PreviewKind = "image" | "video";
export const CONCEPT_LIMITS = { angle: 500, hook: 500, script: 3000, cta: 500, format: 120 } as const;
export const MUTABLE_CAMPAIGN_STATES = new Set(["draft", "scanning", "planning", "ready_for_desk"]);

export function readConcepts(value: unknown): CampaignConcept[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const concepts = (value as { concepts?: unknown }).concepts;
  if (!Array.isArray(concepts) || concepts.length !== 3) return [];
  if (!concepts.every((item) => item && typeof item === "object" && !Array.isArray(item)
    && Object.entries(CONCEPT_LIMITS).every(([key, max]) => {
      const field = (item as Record<string, unknown>)[key];
      return typeof field === "string" && field.trim().length > 0 && field.length <= max;
    }))) return [];
  return concepts.map((item) => Object.fromEntries(Object.keys(CONCEPT_LIMITS).map((key) =>
    [key, (item as Record<string, string>)[key].trim()])) as CampaignConcept);
}

export function previewRequestHash(input: { campaignId: string; creativeId: string; revision: number; kind: PreviewKind; creatorId: string | null; prompt: string; referenceHash?: string | null }): string {
  return createHash("sha256").update(JSON.stringify([
    input.campaignId, input.creativeId, input.revision, input.kind, input.creatorId,
    input.prompt, input.referenceHash ?? null,
  ])).digest("hex");
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function previewConsentIsValid(input: { status: string; expires_at: string; creative_revision: number; request_hash: string; creator_id: string | null; reference_object_key: string | null; reference_sha256: string | null }, creativeRevision: number, now = Date.now()): boolean {
  return input.status === "approved" && Date.parse(input.expires_at) > now
    && input.creative_revision === creativeRevision
    && Boolean(input.request_hash)
    && (!input.creator_id || Boolean(input.reference_object_key && input.reference_sha256));
}

export function safeProviderStatusUrl(value: unknown, requestId: string): string | null {
  if (typeof value !== "string" || !isUuid(requestId)) return null;
  try {
    const url = new URL(value);
    return url.origin === "https://api.higgsfield.ai" && url.pathname === `/requests/${requestId}/status`
      && !url.username && !url.password && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
