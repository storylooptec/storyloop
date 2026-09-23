import { MockInstagramProvider } from "@/integrations/mock-instagram-provider";
import type { SocialProvider } from "@/integrations/types";

export type ProviderKey =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "email"
  | "push"
  | "llm"
  | "search_enrichment"
  | "cloudflare_r2"
  | "payments"
  | "kyc"
  | "esign"
  | "tracking_attribution";

export function getSocialProvider(providerKey: ProviderKey): SocialProvider {
  if (providerKey === "instagram") {
    return new MockInstagramProvider();
  }

  throw new Error(`Social provider adapter not implemented: ${providerKey}`);
}
