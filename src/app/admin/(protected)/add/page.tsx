import { IllustrativeNote } from "@/components/admin/illustrative-note";

export default function AddPage() {
  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Ingest</p>
          <h1 className="page-title">Add creators</h1>
          <p className="page-copy">
            Paste a link, drop a CSV, forward WhatsApp, use a partner link, or receive self-serve onboarding.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="ops-panel ingest-panel">
        <div className="ingest-doors">
          <button type="button" data-active="true">Paste link</button>
          <button type="button">CSV upload</button>
          <button type="button">WhatsApp</button>
          <button type="button">Partner link</button>
          <button type="button">Self-serve</button>
        </div>

        <label className="discover-input">
          <span className="sl-system-label">Creator URL</span>
          <input placeholder="instagram.com/creator" />
        </label>

        <div className="candidate-preview">
          <div>
            <span className="sl-system-label">Fetched record</span>
            <h2>Creator preview</h2>
          </div>
          <p>Identity, metrics, topics and links appear here after fetch.</p>
          <p className="provenance">source · checked date · confidence</p>
        </div>

        <button className="primary-button" type="button">Add to Pool</button>
      </section>
    </div>
  );
}
