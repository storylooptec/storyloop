"use client";

import { useState } from "react";

import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type MoneyState = "coming" | "nothing" | "advance" | "kyc";
const options = [
  { value: "coming", label: "Coming in" },
  { value: "nothing", label: "Nothing due" },
  { value: "advance", label: "Advance" },
  { value: "kyc", label: "First KYC" },
] as const;

export function CreatorMoneyDemo({ cms = {} }: { cms?: Record<string, string> }) {
  const [state, setState] = useState<MoneyState>("coming");

  return (
    <div className="creator-screen">
      <CreatorDemoStates label="Money state" value={state} options={options} onChange={setState} />
      <header className="creator-screen-head"><p className="creator-kicker">MONEY</p><h1>A calendar, not a ledger.</h1></header>

      {state === "coming" ? (
        <>
          <section className="creator-wire-card">
            <span className="creator-kicker">COMING IN</span>
            <div className="creator-detail-list">
              <div><span>12 Oct · GlowFit</span><strong>₹16,500</strong></div>
              <div><span>30 Oct · Nykaa</span><strong>₹22,000</strong></div>
            </div>
          </section>
          <section className="creator-wire-card"><div className="creator-money-row"><span>Paid out this year</span><strong>₹1,42,500</strong></div></section>
          <div className="creator-action-row"><button className="creator-secondary">Statements</button><button className="creator-secondary">TDS certs</button></div>
          <article className="creator-wire-card"><p>Invoices are raised for you on every deal — GST and TDS handled. Nothing to do.</p></article>
        </>
      ) : null}

      {state === "nothing" ? (
        <>
          <section className="creator-empty-feed compact"><h2>{cms.money_empty_title ?? "Nothing due right now."}</h2><p>{cms.money_empty_body ?? "Everything from this year is paid and filed."}</p></section>
          <section className="creator-wire-card"><div className="creator-money-row"><span>Paid out this year</span><strong>₹1,42,500</strong></div></section>
          <div className="creator-action-row"><button className="creator-secondary">Statements</button><button className="creator-secondary">TDS certs</button></div>
        </>
      ) : null}

      {state === "advance" ? (
        <section className="creator-wire-card accent">
          <span className="creator-kicker">12 OCT · GLOWFIT · ₹16,500</span>
          <p>Funded by the brand — eligible for advance.</p>
          <h2>Get ₹14,850 today</h2>
          <p>90% now, the rest on the payout date. Fee shown before you tap, never after.</p>
          <button className="creator-primary">Take advance</button>
        </section>
      ) : null}

      {state === "kyc" ? (
        <section className="creator-wire-card">
          <span className="creator-kicker">MONEY · KYC</span>
          <div className="creator-chat creator-chat-sl"><span className="creator-chat-who">STORYLOOP</span>You accepted GlowFit — ₹15,000 is on the table. Where do we send it? PAN and bank, once, reused forever.</div>
          <div className="creator-detail-list">
            <div><span>PAN</span><strong>Needed</strong></div>
            <div><span>Bank</span><strong>Needed</strong></div>
            <div><span>GST</span><strong>Optional</strong></div>
          </div>
          <button className="creator-primary">Add PAN + bank</button>
        </section>
      ) : null}

      <p className="creator-demo-caption">Illustrative client-wireframe data for UX review.</p>
    </div>
  );
}
