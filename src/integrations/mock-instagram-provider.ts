import type {
  SocialProfileResult,
  SocialProvider,
} from "@/integrations/types";

const fixtures: Record<string, Partial<SocialProfileResult>> = {
  normal: {},
  private: {
    isPrivate: true,
    followers: null,
    engagementRate: null,
  },
  failure: {
    fetchFailed: true,
    followers: null,
    engagementRate: null,
  },
  duplicate: {
    duplicateCreator: true,
  },
  stale: {
    stale: true,
  },
  missing: {
    derivedFieldsComplete: false,
  },
  multiple: {
    followers: 84200,
    engagementRate: 3.2,
  },
};

export class MockInstagramProvider implements SocialProvider {
  async fetchProfile(handle: string): Promise<SocialProfileResult> {
    const scenario = handle.toLowerCase().replace(/^@/, "");
    const overrides = fixtures[scenario] ?? {};

    return {
      handle,
      isPrivate: false,
      followers: 125000,
      engagementRate: 4.1,
      fetchedAt: new Date().toISOString(),
      stale: false,
      derivedFieldsComplete: true,
      duplicateCreator: false,
      fetchFailed: false,
      ...overrides,
    };
  }
}
