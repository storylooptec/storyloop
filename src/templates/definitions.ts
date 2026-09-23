export const templateKeys = [
  "whatsapp",
  "email",
  "creator_outreach",
  "brief_notifications",
  "counter_messages",
  "kyc_reminders",
  "payment_payout",
  "contracts",
  "purchase_order",
  "invoices",
] as const;

export type TemplateKey = (typeof templateKeys)[number];
