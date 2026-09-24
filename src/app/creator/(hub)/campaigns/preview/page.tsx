import Link from "next/link";

import { requireCreatorContext } from "@/creator/context";

export default async function CampaignPreviewPage() {
  const context = await requireCreatorContext();

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <Link className="creator-back" href="/creator/campaigns">← Campaigns</Link>
        <p className="creator-kicker">ILLUSTRATIVE · NOT LIVE DATA</p>
        <h1>GlowFit brief</h1>
      </header>

      <section className="creator-brief-card">
        <dl className="creator-kv">
          <div><dt>Deliverable</dt><dd>1 Reel · 30–45s</dd></div>
          <div><dt>Live by</dt><dd>28 Sep</dd></div>
          <div><dt>Usage</dt><dd>Organic · 30d</dd></div>
          <div><dt>You get</dt><dd>₹15,000</dd></div>
          <div><dt>Paid on</dt><dd>12 Oct</dd></div>
        </dl>
        <blockquote>“Morning routine feature, product in the first 5 seconds.”</blockquote>
        <div className="creator-three-actions" aria-label="Brief response preview">
          <button disabled>Accept</button><button disabled>Counter</button><button disabled>Decline</button>
        </div>
      </section>

      <section className="creator-chat-thread">
        <span className="creator-kicker">COUNTER STATE</span>
        <div className="creator-chat creator-chat-me">Counter — ₹18,000</div>
        <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">GLOWFIT</span>₹16,500 with raw files?</div>
        <div className="creator-chat creator-chat-me">Accept ₹16,500</div>
      </section>

      <section className="creator-deal-room">
        <span className="creator-kicker">DEAL ROOM · STATE MODEL</span>
        {["Contract + PO · locked terms", "Funded", "Draft uploaded", "Revision 1 / capped", "Brand sign-off", "Live link + metrics"].map((line, index) => (
          <div className="creator-deal-step" key={line}><span>{index + 1}</span><strong>{line}</strong></div>
        ))}
        <p className="creator-muted">Actual contract, upload, revision, sign-off and metrics engines are not built in this frontend slice.</p>
      </section>

      {context.account.tier === "free" ? (
        <section className="creator-post-wrap-upgrade">
          <span className="creator-kicker">POST-WRAP UPGRADE PROMPT · APPROVED PLACEMENT 1 OF 2</span>
          <strong>Campaign wrapped. Studio can turn your own voice and likeness into approved AI previews.</strong>
          <Link href="/creator/create" className="creator-primary creator-inline-button">See Studio</Link>
        </section>
      ) : null}
    </div>
  );
}
