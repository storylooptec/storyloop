import { requireCreatorContext } from "@/creator/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CreatorStudioPage() {
  const context = await requireCreatorContext();
  const supabase = await createServerSupabaseClient();
  const { data: studio } = await supabase
    .from("creator_studio_profiles")
    .select("*")
    .eq("creator_id", context.account.creator_id)
    .maybeSingle();

  if (context.account.tier === "free") {
    return (
      <div className="creator-screen">
        <p className="creator-kicker">STUDIO · FREE</p>
        <h1>Visible, but locked.</h1>
        <p className="creator-muted">Deal flow remains fully open. Studio is the Paid creation layer.</p>
      </div>
    );
  }

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">STUDIO · {context.account.tier.toUpperCase()}</p>
        <h1>Likeness setup</h1>
        <p className="creator-muted">Creator owns every output. Brand generations require per-generation approval.</p>
      </header>

      <section className="creator-studio-setup">
        <div><span>1</span><strong>Voice</strong><p>Read three lines aloud · ~40s.</p><small>Capture provider not connected.</small></div>
        <div><span>2</span><strong>Six photos</strong><p>{studio?.photos_captured ?? 0} / 6 captured.</p><small>R2 creator capture flow not connected in this frontend shell.</small></div>
        <div><span>3</span><strong>Explicit consent</strong><p>Only me · or Brands can request demos — I approve each one.</p><small>{studio?.consent_scope ? `Current: ${studio.consent_scope}` : "Not chosen yet."}</small></div>
      </section>

      <section className="creator-demo-shell">
        <span className="creator-kicker">ILLUSTRATIVE GENERATION SHELL · PROVIDER NOT CONNECTED</span>
        <div className="creator-demo-media">
          <span>Generated preview appears here</span>
          <div className="creator-watermark">Storyloop · AI preview — not real footage</div>
        </div>
        <div className="creator-action-row">
          <button disabled className="creator-secondary">Save</button>
          <button disabled className="creator-secondary">Regenerate</button>
          <button disabled className="creator-secondary">Use in a pitch</button>
        </div>
      </section>
    </div>
  );
}
