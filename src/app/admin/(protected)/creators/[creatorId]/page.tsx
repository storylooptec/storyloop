import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ creatorId: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function CreatorAdminDetailPage({ params }: Props) {
  const context = await requireAdminContext();
  const { creatorId } = await params;
  const supabase = await createServerSupabaseClient();

  const [relationshipResult, creatorResult, accountResult, socialsResult, studioResult, usageResult] =
    await Promise.all([
      supabase.from("company_creators").select("*").eq("company_id", context.companyId).eq("creator_id", creatorId).maybeSingle(),
      supabase.from("creators").select("*").eq("id", creatorId).maybeSingle(),
      supabase.from("creator_accounts").select("*").eq("company_id", context.companyId).eq("creator_id", creatorId).maybeSingle(),
      supabase.from("creator_social_accounts").select("*").eq("creator_id", creatorId).order("is_primary", { ascending: false }),
      supabase.from("creator_studio_profiles").select("*").eq("creator_id", creatorId).maybeSingle(),
      supabase.from("creator_create_usage").select("*").eq("creator_id", creatorId).order("month_start", { ascending: false }).limit(6),
    ]);

  const relationship = relationshipResult.data;
  const creator = creatorResult.data;
  const account = accountResult.data;
  const socials = socialsResult.data ?? [];
  const studio = studioResult.data;
  const usage = usageResult.data ?? [];

  if (!creator || (!relationship && !account)) notFound();

  const onboarding = asRecord(account?.onboarding_data);
  const rates = asRecord(onboarding.askedRates);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link href="/admin/creators" className="admin-back-link">← Creators</Link>
          <p className="sl-system-label page-eyebrow">Creator record</p>
          <h1 className="page-title">{creator.display_name ?? creator.primary_handle ?? "Unnamed creator"}</h1>
          <p className="page-copy">
            {creator.primary_handle ? "@" + creator.primary_handle : "No verified handle"} · {relationship?.status ?? "Onboarding"}
          </p>
        </div>
      </header>

      <div className="creator-admin-kpis">
        <div><span>Tier</span><strong>{account?.tier ?? "—"}</strong></div>
        <div><span>Onboarding</span><strong>{account?.onboarding_completed ? "Complete" : "Step " + (account?.onboarding_step ?? "—") + "/9"}</strong></div>
        <div><span>Reel asked rate</span><strong>{typeof rates.reel === "number" ? "₹" + rates.reel.toLocaleString("en-IN") : "—"}</strong></div>
        <div><span>Studio</span><strong>{studio?.setup_status ?? "Not set up"}</strong></div>
      </div>

      <section className="overview-two-column">
        <div className="overview-block">
          <h2 className="section-title">Profile & onboarding</h2>
          <dl className="detail-list">
            <div><dt>Phone</dt><dd>{account?.phone ?? "—"}</dd></div>
            <div><dt>Category</dt><dd>{String(onboarding.category ?? "—")}</dd></div>
            <div><dt>City</dt><dd>{String(onboarding.city ?? "—")}</dd></div>
            <div><dt>Languages</dt><dd>{Array.isArray(onboarding.languages) ? onboarding.languages.join(", ") : "—"}</dd></div>
            <div><dt>Exclusions</dt><dd>{Array.isArray(onboarding.exclusions) ? onboarding.exclusions.join(", ") : "—"}</dd></div>
          </dl>
        </div>
        <div className="overview-block">
          <h2 className="section-title">Studio & consent</h2>
          <dl className="detail-list">
            <div><dt>Status</dt><dd>{studio?.setup_status ?? "Not set up"}</dd></div>
            <div><dt>Voice</dt><dd>{studio?.voice_captured ? "Captured" : "No"}</dd></div>
            <div><dt>Photos</dt><dd>{studio?.photos_captured ?? 0}/6</dd></div>
            <div><dt>Consent</dt><dd>{studio?.consent_scope ?? "None"}</dd></div>
            <div><dt>Model</dt><dd>{studio?.model_status ?? "Not created"}</dd></div>
          </dl>
        </div>
      </section>

      <section className="overview-block">
        <h2 className="section-title">Connected profiles</h2>
        {socials.length ? (
          <div className="simple-rows">
            {socials.map((social) => (
              <div key={social.id}>
                <span>{social.platform ?? "Social"} · {social.handle ?? social.profile_url}</span>
                <small>{social.verification_status}</small>
              </div>
            ))}
          </div>
        ) : <p className="overview-muted">No connected profiles.</p>}
      </section>

      <section className="overview-block">
        <h2 className="section-title">Create usage</h2>
        {usage.length ? (
          <div className="simple-rows">
            {usage.map((row) => (
              <div key={row.id}>
                <span>{row.month_start}</span>
                <small>Captions {row.captions_used} · Hashtags {row.hashtags_used}</small>
              </div>
            ))}
          </div>
        ) : <p className="overview-muted">No usage recorded.</p>}
      </section>
    </div>
  );
}
