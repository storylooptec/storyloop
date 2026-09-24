import Link from "next/link";

export default function CreatorCampaignsPage() {
  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CAMPAIGNS</p>
        <h1>Open · Running · Done</h1>
        <p className="creator-muted">Live campaign data is not connected yet. No fictional deals are shown as real.</p>
      </header>

      {["Open", "Running", "Done"].map((group) => (
        <section className="creator-list-group" key={group}>
          <div className="creator-list-heading"><h2>{group}</h2><span>0</span></div>
          <p className="creator-empty-row">No live {group.toLowerCase()} campaigns.</p>
        </section>
      ))}

      <section className="creator-preview-callout">
        <span className="creator-kicker">ILLUSTRATIVE WORKFLOW PREVIEW</span>
        <h2>Review the approved brief → counter → deal-room states</h2>
        <p>Uses the Product Spec example and is explicitly not live campaign data.</p>
        <Link className="creator-secondary creator-inline-button" href="/creator/campaigns/preview">Preview campaign flow</Link>
      </section>
    </div>
  );
}
