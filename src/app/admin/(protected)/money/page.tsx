import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { requireAdminContext } from "@/auth/admin-context";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";

export default async function MoneyPage() {
  const context = await requireAdminContext();
  const senior = context.role === "senior";

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="field-label-with-help sl-system-label page-eyebrow">
            Money · {senior ? "Senior" : "Read only"}
            <ContextHelp
              text={senior ? adminHelp.senior : "Money is visible to Junior users, but moving money remains Senior-only."}
              label="About Money permissions"
            />
          </p>
          <h1 className="page-title">Money</h1>
          <p className="page-copy">
            In, owed, float and cap stay visible. Juniors see numbers but cannot move money.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="money-header">
        <div><span>In from brands</span><strong>₹6,20,000</strong></div>
        <div><span>Owed to creators</span><strong>₹4,15,000</strong></div>
        <div><span>Float now</span><strong>₹1,30,000</strong></div>
        <div>
          <span className="field-label-with-help">Float cap <ContextHelp text={adminHelp.floatCap} label="About float cap" /></span>
          <strong>TBD</strong>
        </div>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label field-label-with-help">
          Payout run · 25 Sep
          <ContextHelp text={adminHelp.kyc} label="About KYC in payout runs" />
        </div>
        <div className="simple-rows money-rows">
          <div><span>Creator A · ₹15,000 · KYC ✓</span></div>
          <div><span>Creator B · ₹30,000 · KYC ✓</span></div>
          <div><span>Creator C · ₹18,000 · KYC pending · chase fired</span></div>
          <div><span>Affiliate partner · ₹9,400 · month-end</span></div>
        </div>
        {senior ? (
          <button className="primary-button" type="button">Review run</button>
        ) : (
          <span className="read-only-note">Senior-only actions</span>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">Exposure</div>
        <div className="simple-rows">
          <div><span>Northstar · ₹2.1L · PO 45d ⚠</span></div>
          <div><span>Fieldnote · ₹1.4L · advance ✓</span></div>
        </div>
      </section>
    </div>
  );
}
