import "server-only";

import { safeProviderStatusUrl, type PreviewKind } from "@/brand/creative";
import { ProviderError } from "@/lib/providers/runtime";

const API = "https://api.higgsfield.ai";
export const PREVIEW_MODELS = {
  image: "marketing-studio/image",
  video: "kling-video/v3.0/std/text-to-video",
} as const;

function auth(): string | null {
  const combined = process.env.HIGGSFIELD_API_KEY?.trim().replace(/^Key\s+/i, "");
  if (combined && /^[^:\s]+:[^:\s]+$/.test(combined)) return `Key ${combined}`;
  const id = process.env.HIGGSFIELD_API_KEY_ID?.trim();
  const secret = process.env.HIGGSFIELD_API_KEY_SECRET?.trim();
  return id && secret && !/[\s:]/.test(id + secret) ? `Key ${id}:${secret}` : null;
}

export function higgsfieldConfiguration(): { ready: boolean; reason: string; maxUsd: number } {
  const maxUsd = Number(process.env.HIGGSFIELD_MAX_PREVIEW_USD);
  if (process.env.HIGGSFIELD_API_ENABLED !== "true") return { ready: false, reason: "AI previews have not been enabled for this workspace yet.", maxUsd: 0 };
  if (!auth()) return { ready: false, reason: "The preview provider needs both its key ID and key secret.", maxUsd: 0 };
  if (!Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > 100) return { ready: false, reason: "An administrator must configure the maximum preview cost.", maxUsd: 0 };
  if (!process.env.HIGGSFIELD_MEDIA_ALLOWED_HOSTS?.trim()) return { ready: false, reason: "Preview media storage must be configured before generation.", maxUsd };
  if (!process.env.R2_PRIVATE_BUCKET_NAME || !process.env.R2_BUCKET_NAME || !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) return { ready: false, reason: "Preview storage is not configured.", maxUsd };
  if (process.env.R2_PRIVATE_BUCKET_NAME === process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_BASE_URL) return { ready: false, reason: "Creator photos and previews require a separate private storage bucket.", maxUsd };
  return { ready: true, reason: "", maxUsd };
}

export function previewPayload(kind: PreviewKind, prompt: string, referenceUrl?: string): Record<string, unknown> {
  if (kind === "image") return {
    prompt, resolution: "2k", aspect_ratio: "9:16", enhance_prompt: false,
    ...(referenceUrl ? { image_urls: [referenceUrl] } : {}),
  };
  if (referenceUrl) throw new ProviderError("creator_video_unsupported");
  return { prompt, duration: 5, sound: "off", aspect_ratio: "9:16", multi_shots: false, cfg_scale: 0.5 };
}

async function request(path: string, options: { method: "POST" | "GET"; body?: unknown; idempotencyKey?: string; submission?: boolean }) {
  const credentials = auth();
  if (!credentials) throw new ProviderError("provider_not_configured");
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: options.method,
      headers: { Authorization: credentials, "Content-Type": "application/json", ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
    });
  } catch { throw new ProviderError(options.submission ? "submission_unknown" : "provider_timeout"); }
  if (!response.ok) {
    if (options.submission && response.status >= 500) throw new ProviderError("submission_unknown");
    const code = response.status === 429 || response.status === 400 ? "provider_rate_limited"
      : response.status === 401 ? "provider_authentication" : response.status === 403 ? "provider_credit_limit"
      : response.status === 422 ? "provider_validation" : response.status === 423 ? "provider_model_blocked" : "provider_failed";
    throw new ProviderError(code);
  }
  try { return await response.json() as Record<string, unknown>; }
  catch { throw new ProviderError(options.submission ? "submission_unknown" : "provider_invalid_response"); }
}

export async function estimatePreview(kind: PreviewKind, payload: Record<string, unknown>) {
  const result = await request(`/estimate/${PREVIEW_MODELS[kind]}`, { method: "POST", body: payload });
  const numeric = (value: unknown) => typeof value === "number" || typeof value === "string" && value.trim().length > 0;
  if (!numeric(result.usd) || !numeric(result.credits)) throw new ProviderError("provider_invalid_estimate");
  const usd = Number(result.usd);
  const credits = Number(result.credits);
  if (!Number.isFinite(usd) || usd < 0 || !Number.isFinite(credits) || credits < 0) throw new ProviderError("provider_invalid_estimate");
  return { usd, credits };
}

export async function submitPreview(model: string, payload: Record<string, unknown>, idempotencyKey: string) {
  if (!Object.values(PREVIEW_MODELS).some((item) => item === model)) throw new ProviderError("provider_model_invalid");
  const result = await request(`/${model}`, { method: "POST", body: payload, idempotencyKey, submission: true });
  const requestId = typeof result.request_id === "string" ? result.request_id : "";
  const statusUrl = safeProviderStatusUrl(result.status_url, requestId);
  if (!statusUrl) throw new ProviderError("submission_unknown");
  return { requestId, statusUrl };
}

export async function getPreviewStatus(statusUrl: string, requestId: string) {
  const safe = safeProviderStatusUrl(statusUrl, requestId);
  if (!safe) throw new ProviderError("provider_invalid_status_url");
  const result = await request(new URL(safe).pathname, { method: "GET" });
  const status = typeof result.status === "string" ? result.status : "";
  if (!["queued", "in_progress", "completed", "failed", "nsfw", "canceled"].includes(status)) throw new ProviderError("provider_invalid_status");
  const images = result.images as Array<{ url?: string }> | undefined;
  const video = result.video as { url?: string } | undefined;
  const mediaUrl = images?.[0]?.url ?? video?.url ?? null;
  if (status === "completed" && (typeof mediaUrl !== "string" || !mediaUrl)) throw new ProviderError("provider_invalid_output");
  return { status, mediaUrl };
}
