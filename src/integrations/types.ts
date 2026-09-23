export type IntegrationState =
  | "disconnected"
  | "mock"
  | "sandbox"
  | "live"
  | "error";

export type SocialProfileResult = {
  handle: string;
  isPrivate: boolean;
  followers: number | null;
  engagementRate: number | null;
  fetchedAt: string;
  stale: boolean;
  derivedFieldsComplete: boolean;
  duplicateCreator: boolean;
  fetchFailed: boolean;
};

export interface SocialProvider {
  fetchProfile(handle: string): Promise<SocialProfileResult>;
}
