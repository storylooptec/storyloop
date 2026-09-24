import Link from "next/link";

import { configByKey, getCreatorConfiguration } from "@/creator/config";
import { requireCreatorContext } from "@/creator/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function meter(used: number) {
  return `${Math.min(used, 5)} / 5 this month`;
}

export default async function CreatorCreatePage() {
  const context = await requireCreatorContext();
  const supabase = await createServerSupabaseClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const key = monthStart.toISOString().slice(0, 10);

  const [{ data: usage }, config] = await Promise.all([
    supabase
      .from("creator_create_usage")
      .select("captions_used,hashtags_used")
      .eq("creator_id", context.account.creator_id)
      .eq("month_start", key)
      .maybeSingle(),
    getCreatorConfiguration(),
  ]);

  const studioCredits = configByKey(config, "studio_credit_allowance");
  const paidPrice = configByKey(config, "creator_paid_price");

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CREATE · {context.account.tier.toUpperCase()}</p>
        <h1>Useful things, using your data.</h1>
      </header>

      <div className="creator-tool-list">
        <article><span className="creator-kicker">CAPTIONS</span><h2>In your tone</h2><p>{context.account.tier === "free" ? meter(usage?.captions_used ?? 0) : "Unmetered"}</p><small>Generation provider not connected yet.</small></article>
        <article><span className="creator-kicker">HASHTAGS</span><h2>Sized to your reach</h2><p>{context.account.tier === "free" ? meter(usage?.hashtags_used ?? 0) : "Unmetered"}</p><small>Reach enrichment and generation provider not connected yet.</small></article>
        <article><span className="creator-kicker">BIO LINK</span><h2>storyloop.me</h2><p>Open at every tier.</p><small>Bio-link analytics engine is not connected yet.</small></article>
        <article><span className="creator-kicker">TEMPLATES</span><h2>Media kit · rate-card story · replies</h2><p>Open at every tier.</p><small>Creator template rendering will use the existing Storyloop template foundation later.</small></article>
      </div>

      {context.account.tier === "free" ? (
        <section className="creator-studio-lock">
          <span className="creator-kicker">STUDIO · LOCKED</span>
          <div className="creator-blurred-own-data">
            <strong>{context.creator?.primary_handle ? `@${context.creator.primary_handle}` : "Your profile"}</strong>
            <span>AI preview · your voice · your likeness</span>
          </div>
          <p>Studio is visible on Free but locked. Paid price: {paidPrice?.is_tbd ? "TBD" : String(paidPrice?.value ?? "TBD")}.</p>
          <small>No upgrade CTA here — the Product Spec permits upgrade prompts only after wrap and in Home empty state.</small>
        </section>
      ) : (
        <section className="creator-studio-open">
          <span className="creator-kicker">STUDIO · OPEN</span>
          <h2>Your voice + likeness</h2>
          <p>Credits this month: {studioCredits?.is_tbd ? "TBD (O2)" : String(studioCredits?.value ?? "TBD")}.</p>
          <Link className="creator-primary creator-inline-button" href="/creator/create/studio">Open Studio</Link>
        </section>
      )}
    </div>
  );
}
