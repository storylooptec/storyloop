"use client";

import Link from "next/link";
import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type CreateState = "free" | "captions" | "exhausted";
const options = [
  { value: "free", label: "Free view" },
  { value: "captions", label: "Tool output" },
  { value: "exhausted", label: "Meter used" },
] as const;

export function CreatorCreateDemo() {
  const [state, setState] = useState<CreateState>("free");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Create state" value={state} options={options} onChange={setState} />
      <header className="creator-screen-head">
        <p className="creator-kicker">CREATE · FREE</p>
        <h1>Free tools on your data.</h1>
      </header>

      {state === "free" ? (
        <>
          <div className="creator-tool-list">
            <button className="creator-tool-row" onClick={() => setState("captions")}>
              <span>✎</span><span><strong>Captions</strong><small>Five options in your voice, learned from your last 20 posts · 5/mo</small></span>
            </button>
            <article className="creator-tool-row">
              <span>#</span><span><strong>Hashtags</strong><small>Sized to your 48K reach, not top-30 spam · 5/mo</small></span>
            </article>
            <article className="creator-tool-row">
              <span>⌁</span><span><strong>Link in bio</strong><small>storyloop.me/sneha · 214 taps this week</small></span>
            </article>
            <article className="creator-tool-row">
              <span>▤</span><span><strong>Templates</strong><small>Media kit, rate-card story, brief replies</small></span>
            </article>
          </div>

          <section className="creator-studio-lock">
            <span className="creator-kicker">STUDIO</span>
            <div className="creator-blurred-own-data"><strong>Sneha · AI preview</strong><span>your own blurred output</span></div>
            <Link className="creator-primary creator-inline-button" href="/creator/create/studio">See what Studio makes</Link>
          </section>
        </>
      ) : null}

      {state === "captions" ? (
        <>
          <div className="creator-surface-head"><span className="creator-kicker">CAPTIONS</span><span>3/5 THIS MONTH</span></div>
          <div className="creator-chat creator-chat-me">leg day reel, gym, hype but not cringe</div>
          <div className="creator-chat creator-chat-sl">
            <span className="creator-chat-who">STORYLOOP</span>
            Five, in your voice:<br />
            1. Legs said no. We said squat.<br />
            2. Day 47 of not skipping.<br />
            3. The floor is lava, apparently.
          </div>
          <div className="creator-action-row"><button className="creator-primary">Copy #2</button><button className="creator-secondary">More like #1</button></div>
        </>
      ) : null}

      {state === "exhausted" ? (
        <>
          <div className="creator-surface-head"><span className="creator-kicker">CAPTIONS</span><span>5/5 USED</span></div>
          <section className="creator-wire-card">
            <strong>That&apos;s five this month.</strong>
            <p>Meter resets 1 Oct. Paid removes the meter entirely.</p>
          </section>
          <section className="creator-paid-tease single">
            <span className="creator-kicker">WITH PAID · ₹X/MO · TBD O1</span>
            <div className="creator-blurred-own-data"><span>own Studio output</span></div>
          </section>
        </>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
