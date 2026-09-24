"use client";

import Link from "next/link";
import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type CampaignState = "active" | "expiring" | "empty";
const options = [
  { value: "active", label: "Active list" },
  { value: "expiring", label: "Expiring" },
  { value: "empty", label: "Empty" },
] as const;

export function CreatorCampaignsDemo({ cms = {} }: { cms?: Record<string, string> }) {
  const [state, setState] = useState<CampaignState>("active");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Campaigns state" value={state} options={options} onChange={setState} />
      <header className="creator-screen-head">
        <p className="creator-kicker">CAMPAIGNS</p>
        <h1>One list, three groups.</h1>
      </header>

      {state === "active" ? (
        <div className="creator-campaign-groups">
          <section>
            <div className="creator-list-heading"><h2>Open</h2></div>
            <Link href="/creator/campaigns/preview" className="creator-campaign-row">
              <span><strong>GlowFit · Reel</strong><small>New — respond by Tue</small></span><b>₹15,000</b>
            </Link>
            <div className="creator-campaign-row">
              <span><strong>boAt · Story</strong><small>Countered — waiting on brand</small></span><b>₹4,000</b>
            </div>
          </section>
          <section>
            <div className="creator-list-heading"><h2>Running</h2></div>
            <div className="creator-campaign-row">
              <span><strong>Nykaa · Reel</strong><small>Draft due Friday</small></span><b>₹22,000</b>
            </div>
          </section>
          <section>
            <div className="creator-list-heading"><h2>Done</h2></div>
            <div className="creator-campaign-row">
              <span><strong>Mamaearth</strong><small>Paid · 182K views</small></span><b>₹12,000</b>
            </div>
          </section>
        </div>
      ) : null}

      {state === "expiring" ? (
        <section className="creator-list-group">
          <div className="creator-list-heading"><h2>Open</h2></div>
          <article className="creator-wire-card accent">
            <div className="creator-money-row"><strong>GlowFit · Reel</strong><b>₹15,000</b></div>
            <p>Expires in 14h — answer or it goes back to the pool.</p>
            <Link href="/creator/campaigns/preview" className="creator-primary creator-inline-button">Open brief →</Link>
          </article>
        </section>
      ) : null}

      {state === "empty" ? (
        <section className="creator-empty-feed">
          <h2>{cms.campaigns_empty_title ?? "No briefs yet."}</h2>
          <p>{cms.campaigns_empty_body ?? "Your card is live — brands in Fitness · Mumbai can already see it. A sharper card gets picked more."}</p>
          <Link className="creator-secondary creator-inline-button" href="/creator/me">Review my card</Link>
        </section>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
