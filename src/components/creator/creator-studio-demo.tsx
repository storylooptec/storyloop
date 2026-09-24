"use client";

import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type StudioState = "setup" | "incomplete" | "onlyme" | "paid" | "generating" | "exhausted" | "access" | "player";
const options = [
  { value: "setup", label: "Setup" },
  { value: "incomplete", label: "Incomplete" },
  { value: "onlyme", label: "Only me" },
  { value: "paid", label: "Paid" },
  { value: "generating", label: "Generating" },
  { value: "exhausted", label: "0 credits" },
  { value: "access", label: "Brand access" },
  { value: "player", label: "Player" },
] as const;

export function CreatorStudioDemo() {
  const [state, setState] = useState<StudioState>("setup");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Studio state" value={state} options={options} onChange={setState} />

      {state === "setup" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">STUDIO SETUP</p><h1>Likeness capture, chat-shaped, once.</h1></header>
          <div className="creator-chat-thread">
            <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>Read these three lines aloud. Takes about 40 seconds.</div>
            <article className="creator-wire-card"><strong>● Recorded 0:42</strong></article>
            <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>Now six photos — front, left, right, smile, neutral, full length.</div>
            <article className="creator-wire-card"><strong>📷 6/6 captured</strong></article>
            <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>Done. Your model belongs to you. Nothing generates without your tap. Who can use it?</div>
          </div>
          <div className="creator-action-stack">
            <button className="creator-secondary" onClick={() => setState("onlyme")}>Only me</button>
            <button className="creator-primary" onClick={() => setState("paid")}>Brands can request demos — I approve each one</button>
          </div>
        </>
      ) : null}

      {state === "incomplete" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">STUDIO SETUP</p><h1>4/6 captured</h1></header>
          <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>Two more — left profile and full length.</div>
          <article className="creator-wire-card"><p>Saved so far; finish anytime, we&apos;ll pick up right here.</p></article>
          <div className="creator-action-row"><button className="creator-primary">Open camera</button><button className="creator-secondary">Later</button></div>
        </>
      ) : null}

      {state === "onlyme" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">STUDIO SETUP · ONLY ME</p><h1>Brand access off.</h1></header>
          <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>Done — brands can&apos;t request demos of you. Studio still works fully for your own content. Change it anytime in Me.</div>
          <section className="creator-wire-card"><div className="creator-detail-list"><div><span>Likeness</span><strong>voice ✓ face ✓</strong></div><div><span>Brand access</span><strong>Off</strong></div></div></section>
        </>
      ) : null}

      {state === "paid" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">STUDIO · PAID ✓</p><h1>Type it, watch yourself do it.</h1></header>
          <section className="creator-wire-card">
            <div className="creator-detail-list"><div><span>Likeness</span><strong>voice ✓ face ✓</strong></div></div>
            <button className="creator-secondary">Manage brand access</button>
          </section>
          <article className="creator-wire-card accent"><strong>▶ Content demo</strong><p>Type an action, watch yourself do it. “unboxing, kitchen, morning light”</p><button className="creator-primary" onClick={() => setState("generating")}>Generate · ~6s</button></article>
          <article className="creator-wire-card"><strong>✦ AI content</strong><p>Script → full reel draft, your voice, your face</p></article>
          <section className="creator-wire-card"><div className="creator-money-row"><span>Credits left this month</span><strong>14 · TBD O2</strong></div></section>
        </>
      ) : null}

      {state === "generating" ? (
        <section className="creator-wire-card accent">
          <span className="creator-kicker">STUDIO · GENERATING</span>
          <h2>“unboxing, kitchen, morning light”</h2>
          <div className="creator-progress"><span /></div>
          <p>About 6 seconds. Stay or leave — it lands in your Home feed either way.</p>
        </section>
      ) : null}

      {state === "exhausted" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">STUDIO · 0 CREDITS</p><h1>Credits reset 1 Oct.</h1></header>
          <section className="creator-wire-card"><p>Top-ups at launch: TBD O2. Everything you&apos;ve made stays available.</p></section>
          <article className="creator-wire-card muted"><strong>✦ AI content</strong><p>Generate is unavailable; drafts, saves and brand access still work.</p></article>
        </>
      ) : null}

      {state === "access" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">BRAND ACCESS</p><h1>Every generation still needs your tap.</h1></header>
          <div className="creator-detail-list">
            <div><span>GlowFit</span><strong>Allowed · 2 demos</strong></div>
            <div><span>Nykaa</span><strong>Asked · pending</strong></div>
            <div><span>boAt</span><strong>Refused</strong></div>
          </div>
          <p className="creator-muted">Allowing a brand only lets them ask.</p>
          <button className="creator-danger">Revoke all — immediate</button>
        </>
      ) : null}

      {state === "player" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">A GENERATED DEMO</p><h1>The watermark travels with the file.</h1></header>
          <div className="creator-demo-player">
            <span>DEMO 0:06</span>
            <div className="creator-player-placeholder">Generated creator demo</div>
            <div className="creator-watermark">STORYLOOP · AI PREVIEW — NOT REAL FOOTAGE</div>
          </div>
          <p className="creator-muted">Burned into the media, never removable UI.</p>
          <div className="creator-action-row"><button className="creator-secondary">Save</button><button className="creator-secondary">Regenerate</button><button className="creator-primary">Use in a pitch</button></div>
        </>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
