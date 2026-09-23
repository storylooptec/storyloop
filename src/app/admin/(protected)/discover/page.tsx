import { IllustrativeNote } from "@/components/admin/illustrative-note";

export default function DiscoverPage() {
  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Discovery</p>
          <h1 className="page-title">Discover</h1>
          <p className="page-copy">
            Plain words in. Expansion, sources, spend and evidence stay visible.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="ops-panel discover-run">
        <label className="discover-input">
          <span className="sl-system-label">Run query</span>
          <input defaultValue="mumbai fashion, hindi+english" />
        </label>

        <div className="expansion-block">
          <span className="sl-system-label">Expands to</span>
          <div className="parsed-chips">
            <span className="query-chip">#mumbaifashion ×</span>
            <span className="query-chip">street style ×</span>
            <span className="query-chip">indian labels ×</span>
          </div>
          <p className="provenance">Sources: official social APIs · hosted search · RSS</p>
        </div>

        <div className="run-meter">
          <div><span>Found</span><strong>118</strong></div>
          <div><span>Deduped</span><strong>74</strong></div>
          <div><span>Enriched</span><strong>22</strong></div>
          <div><span>Spend</span><strong>₹142 / TBD cap</strong></div>
        </div>

        <button className="primary-button" type="button">Run discovery</button>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">Past runs</div>
        <div className="simple-rows">
          <div><span>#30 · pune fitness · 19 added · 2d</span><button type="button">Re-run</button></div>
          <div><span>#29 · kolkata food · 7 added · 5d</span><button type="button">Re-run</button></div>
        </div>
      </section>
    </div>
  );
}
