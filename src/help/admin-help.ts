export const adminHelp = {
  roas:
    "Return on ad spend: revenue attributed to a campaign divided by advertising spend.",
  engagementRate:
    "Engagement rate compares average engagement with follower count using Storyloop's defined metric window.",
  floatCap:
    "The maximum amount Storyloop may temporarily fund before brand payment is received.",
  discoveryCap:
    "The maximum allowed spend for one discovery run. Raising the cap is senior-only.",
  minuteCounter:
    "Average manual time logged per campaign. It is used to identify what should be automated next.",
  provenance:
    "Shows where a metric came from, when it was checked, and the confidence in that data.",
  freshness:
    "How recently creator or brand data was checked. Stale records should be refreshed before relying on them.",
  kyc:
    "Know Your Customer verification. In Storyloop it is requested only when a creator reaches the Funded gate.",
  paidExclusive:
    "Paid · E means a Paid creator with the Exclusive flag. Exclusive is not a separate tier.",
  candidateScore:
    "Storyloop's candidate ranking score. The score must always be shown with its reason and supporting evidence.",
  mock:
    "Uses simulated provider responses so development and QA can continue without a live external service.",
  sandbox:
    "Uses a provider's test environment or test credentials without affecting production data or money.",
  live:
    "Uses the real production provider and may create real external effects.",
  disconnected:
    "No active provider connection is being used for this integration.",
  integrationError:
    "The integration is configured but currently needs attention before it can be relied on.",
  featureFlag:
    "Controls whether a product capability is available without requiring a code deployment.",
  tbd:
    "The product decision has not been finalized. Storyloop keeps it configurable instead of guessing a value.",
  humanReview:
    "The system may prepare the draft, but a person must review it before anything is sent externally.",
  junior:
    "Junior users can perform operational work, prepare drafts, and take reversible actions within configured limits.",
  senior:
    "Senior users can approve and send, grant Verified status, perform financial actions, and override configured caps.",
  reversibleAction:
    "An action designed to be safely undone. Storyloop prefers undo over unnecessary permission gates.",
  auditUndo:
    "Indicates whether the recorded action can be safely reversed and, where supported, which undo action applies.",
  configurationValue:
    "A company-level operating rule stored outside code so it can change without a redeploy.",
  systemField:
    "A technical identifier used by Storyloop internally. Change it only when you understand the downstream effect.",
  roster:
    "Consented creators who can appear in brand-facing workflows.",
  pool:
    "Discovered candidates who have not yet consented. Pool records never appear in brand-facing shortlists.",
  stateRail:
    "The campaign's single source of truth: Brief → Shortlist → Approved → Funded → Live → Paid.",
} as const;

export type AdminHelpKey = keyof typeof adminHelp;
