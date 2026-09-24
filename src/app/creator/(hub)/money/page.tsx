export default function CreatorMoneyPage() {
  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">MONEY</p>
        <h1>What&apos;s coming in</h1>
        <p className="creator-muted">A payment calendar, not an accounting ledger.</p>
      </header>

      <section className="creator-empty-feed">
        <h2>Nothing due yet.</h2>
        <p>Funded → due → processing → paid will appear per deal when the payment engine exists.</p>
      </section>

      <section className="creator-list-group">
        <div className="creator-list-heading"><h2>Payment states</h2><span>Preview</span></div>
        <div className="creator-state-rail">
          {["Funded", "Due", "Processing", "Paid"].map((state) => <span key={state}>{state}</span>)}
        </div>
      </section>

      <section className="creator-guidance">
        <span className="creator-kicker">KYC</span>
        <strong>Requested at the first accepted brief — never during onboarding.</strong>
        <p>PAN, GST and bank details are not collected until that event exists.</p>
      </section>

      <div className="creator-action-row">
        <button className="creator-secondary" disabled>Statements</button>
        <button className="creator-secondary" disabled>TDS certificates</button>
      </div>
    </div>
  );
}
