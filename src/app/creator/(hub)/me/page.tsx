import { requireCreatorContext } from "@/creator/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { creatorSignOut } from "./actions";

export default async function CreatorMePage() {
  const context = await requireCreatorContext();
  const supabase = await createServerSupabaseClient();
  const [{ data: socials }, { data: studio }] = await Promise.all([
    supabase.from("creator_social_accounts").select("profile_url,handle,verification_status,is_primary").eq("creator_id", context.account.creator_id),
    supabase.from("creator_studio_profiles").select("setup_status,consent_scope,model_status").eq("creator_id", context.account.creator_id).maybeSingle(),
  ]);

  const exclusions = Array.isArray(context.account.onboardingData.exclusions)
    ? context.account.onboardingData.exclusions.filter((x): x is string => typeof x === "string")
    : [];

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">ME · {context.account.tier.toUpperCase()}</p>
        <h1>{context.creator?.display_name ?? context.creator?.primary_handle ?? "Your Storyloop record"}</h1>
        <p className="creator-muted">This is the single Creator record. Editing remains in place as providers and benchmarks come online.</p>
      </header>

      <section className="creator-profile-card">
        <span className="creator-kicker">CARD AS BRANDS SEE IT</span>
        <strong>{context.creator?.primary_handle ? `@${context.creator.primary_handle}` : "Handle not verified"}</strong>
        <p>Metrics are not shown until a real enrichment source supplies provenance, date and confidence.</p>
      </section>

      <section className="creator-detail-list">
        <div><span>Tier</span><strong>{context.account.tier}</strong></div>
        <div><span>Verified</span><strong>TBD criteria · O3</strong></div>
        <div><span>Availability</span><strong>Not set</strong></div>
        <div><span>Won&apos;t promote</span><strong>{exclusions.length ? exclusions.join(" · ") : "None saved"}</strong></div>
        <div><span>Rate card</span><strong>TBD anchor · O5</strong></div>
      </section>

      <section className="creator-list-group">
        <div className="creator-list-heading"><h2>Connected profiles</h2><span>{socials?.length ?? 0}</span></div>
        {(socials ?? []).map((social) => (
          <div className="creator-simple-row" key={social.profile_url}>
            <span>{social.handle ? `@${social.handle}` : social.profile_url}</span>
            <small>{social.verification_status}</small>
          </div>
        ))}
      </section>

      <section className="creator-guidance">
        <span className="creator-kicker">LIKENESS</span>
        <strong>{studio?.setup_status ?? "Not set up"}</strong>
        <p>Consent: {studio?.consent_scope ?? "none"} · Model: {studio?.model_status ?? "not created"}. Revoke controls become live when the model pipeline exists.</p>
      </section>

      {context.account.tier === "exclusive" ? (
        <section className="creator-managed-strip">
          <span className="creator-kicker">EXCLUSIVE · EVERYTHING INCLUDED</span>
          <p>No Paid billing UI. POC and monthly plan surface here when assigned.</p>
        </section>
      ) : null}

      <section className="creator-account-controls">
        <span className="creator-kicker">ACCOUNT & PREFERENCES</span>
        <p>Notification channels, five Indian languages, delist/export and public-profile behaviour remain source-defined surfaces; specific language set and O8 public-profile decision are not invented here.</p>
        <form action={creatorSignOut}><button className="creator-secondary" type="submit">Sign out</button></form>
      </section>
    </div>
  );
}
