import { IllustrativeNote } from "@/components/admin/illustrative-note";

export default function BrandsPage() {
  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Brand rooms</p>
          <h1 className="page-title">Brands</h1>
          <p className="page-copy">
            One intelligence room per brand. Every section keeps its sources and refresh date.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="ops-panel brand-room-preview">
        <div className="room-owner">
          <div>
            <span className="sl-system-label">Illustrative brand room</span>
            <h2>Northstar Skincare</h2>
          </div>
          <span className="sl-system-label">Owner · Priya</span>
        </div>

        <div className="room-kpis">
          <div><span>Pipeline</span><strong>8 / 9 stages</strong></div>
          <div><span>Spend</span><strong>₹96</strong></div>
          <div><span>Refresh</span><strong>TBD</strong></div>
        </div>

        <div className="pipeline-list">
          <div><span>Company</span><strong>✓</strong><small>source · checked · confidence</small></div>
          <div><span>Audience</span><strong>✓</strong><small>source · checked · confidence</small></div>
          <div><span>Competitors</span><strong>5 ✓</strong><small>replaceable · sourced</small></div>
          <div><span>Reviews</span><strong>68% positive ✓</strong><small>source · checked · confidence</small></div>
          <div><span>Gaps</span><strong>6 ranked ✓</strong><small>why + sources</small></div>
          <div><span>Matches</span><strong>Scoring…</strong><small>roster only</small></div>
        </div>

        <div className="ops-action-row">
          <button className="secondary-button" type="button">Read & fix</button>
          <button className="primary-button" type="button">Save draft</button>
        </div>
      </section>
    </div>
  );
}
