import { requireAdminContext } from "@/auth/admin-context";
import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { StateRail } from "@/components/admin/state-rail";

const columns = ["Brief", "Shortlist", "Approved", "Funded", "Live", "Paid"];

export default async function CampaignsPage() {
  const context = await requireAdminContext();
  const senior = context.role === "senior";
  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Single state machine</p>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-copy">
            Six states. Cards move one column at a time; blockers remain on the card.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="campaign-board">
        {columns.map((column) => (
          <div className="campaign-column" key={column}>
            <span className="sl-system-label">{column}</span>
            {column === "Approved" ? (
              <article className="board-card">
                <strong>Fieldnote · Autumn launch</strong>
                <p>⚠ KYC — 1 of 5 creators clearing</p>
                <StateRail current="Approved" />
              </article>
            ) : null}
            {column === "Live" ? (
              <article className="board-card">
                <strong>Northstar · Vitamin-C</strong>
                <p>Desk report refreshed weekly</p>
                <StateRail current="Live" />
              </article>
            ) : null}
          </div>
        ))}
      </section>

      <section className="ops-panel launch-strip">
        <div className="ops-panel-heading sl-system-label">Active launch · tap 2 of 5</div>
        <div className="tap-strip">
          <span data-state="done">① Brief ✓</span>
          <span data-state="current">② Shortlist</span>
          <span>③ Offers</span>
          <span>④ Contracts</span>
          <span>⑤ Kit</span>
        </div>
        {senior ? (
          <button className="primary-button" type="button">Review & send</button>
        ) : (
          <button className="secondary-button" type="button">Save draft</button>
        )}
      </section>
    </div>
  );
}
