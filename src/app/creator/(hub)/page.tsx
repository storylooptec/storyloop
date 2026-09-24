import Link from "next/link";

import { requireCreatorContext } from "@/creator/context";

export default async function CreatorHomePage() {
  const context = await requireCreatorContext();
  const tier = context.account.tier;
  const entitlement = context.account.entitlementState;
  const poc = typeof entitlement.pocName === "string" ? entitlement.pocName : null;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">HOME</p>
        <h1>What needs you now</h1>
      </header>

      {tier === "exclusive" ? (
        <section className="creator-managed-strip">
          <span className="creator-kicker">MANAGED · EXCLUSIVE</span>
          <strong>{poc ? `${poc} is your Storyloop POC` : "Your POC is not assigned yet"}</strong>
          <p>Everything in Paid is included. Storyloop negotiates; you approve final terms.</p>
        </section>
      ) : null}

      <section className="creator-empty-feed">
        <span className="creator-status-dot" aria-hidden="true" />
        <h2>Nothing needs you today.</h2>
        <p>New briefs, draft deadlines, revisions, sign-offs, payments and AI-demo requests will land here.</p>
      </section>

      <section className="creator-guidance">
        <span className="creator-kicker">GUIDANCE</span>
        <p>Rate and category guidance will use your real profile data once enrichment is connected.</p>
      </section>

      {tier === "free" ? (
        <section className="creator-paid-tease">
          <div className="creator-blurred-own-data" aria-hidden="true">
            <strong>{context.creator?.primary_handle ? `@${context.creator.primary_handle}` : "Your profile"}</strong>
            <span>Own numbers vs peers · Studio preview</span>
          </div>
          <div className="creator-paid-tease-copy">
            <span className="creator-kicker">WITH PAID · PRICE TBD</span>
            <strong>Your own Studio and deeper insights exist here.</strong>
            <p>This is the one Home empty-state upgrade prompt defined by the Product Spec.</p>
            <Link className="creator-primary creator-inline-button" href="/creator/create">See Create</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
