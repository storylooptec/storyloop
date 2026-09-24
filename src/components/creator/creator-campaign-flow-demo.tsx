"use client";

import Link from "next/link";
import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type FlowState = "brief" | "countered" | "expired" | "declined" | "signoff" | "revision" | "live" | "metrics";
const options = [
  { value: "brief", label: "Brief" },
  { value: "countered", label: "Countered" },
  { value: "expired", label: "Expired" },
  { value: "declined", label: "Declined" },
  { value: "signoff", label: "Deal room" },
  { value: "revision", label: "Rev cap" },
  { value: "live", label: "Live" },
  { value: "metrics", label: "Metrics" },
] as const;

export function CreatorCampaignFlowDemo() {
  const [state, setState] = useState<FlowState>("brief");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Brief / deal state" value={state} options={options} onChange={setState} />
      <Link className="creator-back" href="/creator/campaigns">← Campaigns</Link>

      {state === "brief" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">NEW · TERMS + PAYMENT DATE FIRST</p><h1>← GlowFit · Brief</h1></header>
          <section className="creator-brief-card">
            <dl className="creator-kv">
              <div><dt>Deliverable</dt><dd>1 Reel · 30–45s</dd></div>
              <div><dt>Live by</dt><dd>28 Sep</dd></div>
              <div><dt>Usage</dt><dd>Organic · 30d</dd></div>
              <div><dt>You get</dt><dd>₹15,000</dd></div>
              <div><dt>Paid on</dt><dd>12 Oct</dd></div>
            </dl>
            <blockquote>“Morning routine feature, product in the first 5 seconds.”</blockquote>
            <div className="creator-three-actions"><button>Accept</button><button>Counter</button><button>Decline</button></div>
          </section>
        </>
      ) : null}

      {state === "countered" ? (
        <>
          <header className="creator-screen-head"><p className="creator-kicker">COUNTERED · RUNS AS CHAT</p><h1>← GlowFit · Countered</h1></header>
          <article className="creator-wire-card">
            <div className="creator-money-row"><span>You get</span><strong>₹15,000 → ₹18,000?</strong></div>
            <div className="creator-money-row"><span>Paid on</span><strong>12 Oct</strong></div>
          </article>
          <div className="creator-chat-thread">
            <div className="creator-chat creator-chat-me">Counter — ₹18,000</div>
            <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">GLOWFIT</span>₹16,500 with raw files?</div>
            <button className="creator-primary creator-inline-button">Accept ₹16,500</button>
          </div>
          <p className="creator-footnote">Waiting on brand · nudge goes out at 48h.</p>
        </>
      ) : null}

      {state === "expired" ? (
        <section className="creator-wire-card">
          <span className="creator-kicker">← GLOWFIT · EXPIRED</span>
          <div className="creator-money-row"><span>You get</span><strong>Expired 23 Sep</strong></div>
          <p>This brief lapsed unanswered and went back to the pool. Your card wasn&apos;t affected.</p>
          <button className="creator-secondary">I&apos;m still interested</button>
        </section>
      ) : null}

      {state === "declined" ? (
        <section className="creator-wire-card">
          <span className="creator-kicker">← GLOWFIT · DECLINED</span>
          <p>Noted. Why? One tap helps us send better briefs.</p>
          <div className="creator-chip-grid">
            {["Rate too low ✓","Wrong brand fit","No time","Excluded category"].map((item)=><button className="creator-chip" key={item}>{item}</button>)}
          </div>
          <small>Reason feeds matching, never shown to the brand verbatim.</small>
        </section>
      ) : null}

      {state === "signoff" ? (
        <DealRoom title="GLOWFIT · REEL" amount="₹16,500" rows={[
          ["Contract","Signed ✓"],["Script","Approved ✓"],["Draft","Uploaded ✓"],["Brand sign-off","Waiting"],["Post live","—"],["Paid","12 Oct"]
        ]}>
          <p className="creator-muted">Revisions · Round 1 of 2 used. Round three is a chargeable change, not a favour.</p>
        </DealRoom>
      ) : null}

      {state === "revision" ? (
        <DealRoom title="GLOWFIT · REEL" amount="₹16,500" rows={[["Draft","Rev 2 of 2 ✓"],["Brand sign-off","Requested rev 3"]]}>
          <article className="creator-tbd-gate">
            <span className="creator-kicker">CAP REACHED</span>
            <strong>Included rounds are used.</strong>
            <p>A third revision adds ₹2,500 to the deal — the brand has been told.</p>
          </article>
          <div className="creator-action-row"><button className="creator-primary">Accept paid rev</button><button className="creator-secondary">Escalate to Storyloop</button></div>
        </DealRoom>
      ) : null}

      {state === "live" ? (
        <DealRoom title="GLOWFIT · REEL" amount="₹16,500" rows={[["Brand sign-off","Done ✓"],["Post live","26 Sep"],["Paid","12 Oct"]]}>
          <button className="creator-primary creator-inline-button">File live link</button>
          <p className="creator-muted">Metrics pull back automatically once the link is filed. Nothing to screenshot.</p>
        </DealRoom>
      ) : null}

      {state === "metrics" ? (
        <>
          <DealRoom title="GLOWFIT · REEL" amount="DONE" rows={[["Views · 7d","2,10,000"],["Saves","4,120"],["Paid","12 Oct ✓"]]} />
          <section className="creator-paid-tease single">
            <span className="creator-kicker">WITH PAID · POST-WRAP MOMENT</span>
            <strong>Top ▓▓% of Fitness creators in Mumbai</strong>
            <div className="creator-blurred-own-data"><span>own-numbers insight</span></div>
          </section>
        </>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}

function DealRoom({
  title,
  amount,
  rows,
  children,
}: {
  title: string;
  amount: string;
  rows: [string,string][];
  children?: React.ReactNode;
}) {
  return (
    <section className="creator-deal-room-card">
      <div className="creator-money-row creator-deal-title"><strong>{title}</strong><b>{amount}</b></div>
      <div className="creator-detail-list">
        {rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {children}
    </section>
  );
}
