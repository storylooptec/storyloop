"use client";

import Link from "next/link";
import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type HomeState = "active" | "empty" | "exclusive";
const options = [
  { value: "active", label: "Active" },
  { value: "empty", label: "Empty" },
  { value: "exclusive", label: "Exclusive" },
] as const;

export function CreatorHomeDemo() {
  const [state, setState] = useState<HomeState>("active");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Home state" value={state} options={options} onChange={setState} />

      {state === "exclusive" ? (
        <section className="creator-managed-strip creator-managed-full">
          <span className="creator-kicker">STORYLOOP ◆ MANAGED</span>
          <div className="creator-managed-grid">
            <div><span>Your POC</span><strong>Akshit · replies in ~2h</strong><button className="creator-secondary">Message</button></div>
            <div><span>This month&apos;s plan</span><strong>4 posts mapped · 2 booked</strong></div>
          </div>
        </section>
      ) : null}

      <section className="creator-surface-head">
        <span className="creator-kicker">{state === "empty" ? "HOME" : "NEEDS YOU"}</span>
        {state === "active" ? <span className="creator-unread-count">3</span> : null}
      </section>

      {state === "active" ? (
        <div className="creator-feed">
          <article className="creator-feed-card accent">
            <span className="creator-feed-dot" />
            <strong>GlowFit — new brief</strong>
            <p>Reel · ₹15,000 · live by 28 Sep</p>
            <Link className="creator-primary creator-inline-button" href="/creator/campaigns/preview">See brief →</Link>
          </article>
          <article className="creator-feed-card">
            <strong>Nykaa — draft due Friday</strong>
            <button className="creator-secondary">Upload draft</button>
          </article>
          <article className="creator-feed-card accent">
            <span className="creator-feed-dot" />
            <strong>GlowFit requested an AI demo</strong>
            <p>“applying serum, mirror” — uses your likeness</p>
            <div className="creator-action-row">
              <button className="creator-primary">Allow once</button>
              <button className="creator-secondary">View</button>
              <button className="creator-secondary">No</button>
            </div>
          </article>
          <article className="creator-feed-card success">
            <strong>Mamaearth paid ₹12,000</strong>
          </article>
        </div>
      ) : null}

      {state === "empty" ? (
        <>
          <section className="creator-empty-feed compact">
            <h2>Nothing needs you today.</h2>
          </section>
          <section className="creator-list-group">
            <div className="creator-list-heading"><h2>Meanwhile</h2></div>
            <article className="creator-wire-card">
              <p>Fitness rates moved +8% this month. Your card hasn&apos;t.</p>
              <Link className="creator-secondary creator-inline-button" href="/creator/me">Review rates</Link>
            </article>
            <article className="creator-wire-card">
              <p>Reels under 30s are winning your category this week.</p>
            </article>
          </section>
          <section className="creator-paid-tease single">
            <span className="creator-kicker">WITH PAID · ₹X/MO · TBD O1</span>
            <strong>How your last reel did vs 214 fitness creators</strong>
            <div className="creator-blurred-own-data"><span>your own performance comparison</span></div>
          </section>
        </>
      ) : null}

      {state === "exclusive" ? (
        <div className="creator-feed">
          <article className="creator-feed-card accent">
            <span className="creator-kicker">STORYLOOP IS NEGOTIATING</span>
            <strong>boAt · reel · at ₹25,000</strong>
            <p>You approve final terms.</p>
          </article>
          <article className="creator-feed-card">
            <strong>Nykaa — draft due Friday</strong>
          </article>
          <article className="creator-wire-card">
            <span className="creator-kicker">PLAN</span>
            <strong>Exclusive · everything included</strong>
            <p>Studio open · ₹0 · no billing UI.</p>
          </article>
        </div>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
