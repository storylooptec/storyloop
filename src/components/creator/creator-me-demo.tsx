"use client";

import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type MeState = "card" | "review" | "revoked" | "exclusive";
const options = [
  { value: "card", label: "Card" },
  { value: "review", label: "Verified review" },
  { value: "revoked", label: "Revoked/stale" },
  { value: "exclusive", label: "Exclusive" },
] as const;

export function CreatorMeDemo({ cms = {} }: { cms?: Record<string, string> }) {
  const [state, setState] = useState<MeState>("card");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Me state" value={state} options={options} onChange={setState} />

      {state === "card" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">ME · VERIFIED ✓</p><h1>The record you control.</h1></header>
          <section className="creator-profile-card">
            <strong>Sneha Patil · Fitness · Mumbai</strong>
            <p>48.2K · 6.27% ER · exactly what brands see</p>
          </section>
          <section className="creator-list-group">
            <div className="creator-list-heading"><h2>Rate card</h2></div>
            <div className="creator-detail-list"><div><span>Reel</span><strong>₹15,000</strong></div><div><span>Story</span><strong>₹2,500</strong></div></div>
            <button className="creator-secondary creator-inline-button">Edit rates</button>
          </section>
          <section className="creator-detail-list">
            <div><span>Availability</span><strong>Open ▾</strong></div>
            <div><span>Won&apos;t promote</span><strong>Betting · Tobacco</strong></div>
          </section>
          <section className="creator-wire-card">
            <span className="creator-kicker">LIKENESS</span>
            <p>Voice ✓ face ✓ · 2 brands allowed · 6 demos ever generated</p>
            <button className="creator-danger">Revoke — immediate</button>
          </section>
          <button className="creator-primary">{cms.me_media_kit_label ?? "Share my media kit"}</button>
          <section className="creator-me-secondary-grid">
            {["Campaign history","Brand memory","Earnings by brand/month","Peer benchmark","Notifications","Language · 5 Indian languages","Delist","Export data"].map((item)=><button className="creator-secondary" key={item}>{item}</button>)}
          </section>
        </>
      ) : null}

      {state === "review" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">ME · REVIEW</p><h1>Verified</h1></header>
          <section className="creator-wire-card">
            <strong>In review</strong>
            <p>A person reviews and logs a reason either way.</p>
            <span className="creator-kicker">CRITERIA · TBD O3</span>
            <p>Payment fast-tracks the review, never the badge.</p>
          </section>
        </>
      ) : null}

      {state === "revoked" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">ME · VERIFIED ✓</p><h1>Likeness & availability</h1></header>
          <section className="creator-wire-card"><span className="creator-kicker">LIKENESS</span><strong>Revoked · effective now</strong><p>No brand can request demos. Existing previews are withdrawn from brand queries. Re-enable anytime.</p></section>
          <section className="creator-wire-card"><span className="creator-kicker">AVAILABILITY</span><strong>Set 90 days ago</strong><p>Still “Open”? Brands see the freshness stamp too.</p><div className="creator-action-row"><button className="creator-primary">Still open</button><button className="creator-secondary">Busy till Nov</button></div></section>
        </>
      ) : null}

      {state === "exclusive" ? (
        <>
          <section className="creator-managed-strip creator-managed-full">
            <span className="creator-kicker">STORYLOOP ◆ MANAGED</span>
            <div className="creator-managed-grid">
              <div><span>Your POC</span><strong>Akshit · replies in ~2h</strong><button className="creator-secondary">Message</button></div>
              <div><span>This month&apos;s plan</span><strong>4 posts mapped · 2 booked</strong></div>
            </div>
          </section>
          <section className="creator-wire-card"><span className="creator-kicker">STORYLOOP IS NEGOTIATING</span><strong>boAt · reel · at ₹25,000</strong><p>You approve final terms.</p></section>
          <section className="creator-detail-list">
            <div><span>Plan</span><strong>Exclusive · everything included</strong></div>
            <div><span>Studio</span><strong>Open · ₹0</strong></div>
            <div><span>Credits</span><strong>14 / mo</strong></div>
            <div><span>Billing UI</span><strong>None</strong></div>
          </section>
          <section className="creator-wire-card"><span className="creator-kicker">INSIGHTS</span><strong>Your numbers vs peers + monthly plan</strong><p>Entry criteria remain TBD O7.</p></section>
        </>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
