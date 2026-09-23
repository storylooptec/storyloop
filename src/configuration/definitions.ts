export const configurationKeys = [
  "creator_paid_price",
  "studio_credit_allowance",
  "brand_pro_price",
  "basic_discovery_allowance",
  "competitor_limit",
  "invite_lapse",
  "discovery_spend_cap",
  "freshness_threshold",
  "outreach_nudge_interval",
  "candidate_deletion",
  "revision_limit",
  "float_cap",
  "ai_preview_availability",
  "feature_availability",
] as const;

export type ConfigurationKey = (typeof configurationKeys)[number];

export const configurationCategories = [
  "commercial",
  "discovery",
  "workflow",
  "features",
] as const;
