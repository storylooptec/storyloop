import { createServerSupabaseClient } from "@/lib/supabase/server";
import { correctProviderInvoiceAction, recordProviderInvoiceAction } from "./billing-actions";

type Props = { from:string; to:string; provider?:string; canRecord:boolean; result?:string; requestFiltersActive:boolean };
const providers = ["serpapi","openai","higgsfield","r2","supabase"];
const money = (value:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
const messages: Record<string,string> = {
  saved:"Provider invoice recorded and audit logged.",corrected:"Invoice amount corrected with an audit record.",
  duplicate:"That provider invoice is already recorded. Use its correction form if the recorded amount needs to change.",
  invalid:"Check the provider, invoice dates and amount, and verify that the source invoice is issued in USD. Corrections also need a reason.",
  conflict:"The invoice changed while you were editing it. Reload and review its current amount.",failed:"The invoice could not be recorded. Check your finance permission and try again.",
};
export async function ProviderBilling({from,to,provider,canRecord,result,requestFiltersActive}:Props) {
  const db = await createServerSupabaseClient();
  let query = db.from("external_api_bills").select("id,provider_key,invoice_reference,amount_usd,billed_at,period_start,period_end,updated_at",{count:"exact"})
    .gte("billed_at",from).lte("billed_at",to).order("billed_at",{ascending:false}).order("created_at",{ascending:false}).limit(500);
  if (provider) query = query.eq("provider_key",provider);
  const {data,error,count} = await query;
  if (error) throw new Error("Unable to load provider invoice ledger.");
  const bills = data ?? [];
  return <section className="settings-section" id="provider-billing">
    <h2>Actual provider invoices</h2><p className="page-copy">Record provider-issued subscription and usage invoices separately from per-request estimates. These invoices may already include the request-level amounts above; do not add the two totals together. Only record native USD invoices here. Do not enter an unverified currency conversion.</p>
    {messages[result ?? ""] ? <p className="settings-notice" role={result === "saved" || result === "corrected" ? "status" : "alert"}>{messages[result ?? ""]}</p> : null}
    {requestFiltersActive ? <p className="settings-notice">Invoices are provider account bills. The request company and status filters do not apply to this ledger.</p> : null}
    <div className="overview-grid"><article className="overview-card"><span className="sl-system-label">Actual invoiced spend · USD</span><strong>{bills.length ? money(bills.reduce((total,bill) => total+Number(bill.amount_usd),0)) : "No invoices recorded"}</strong><small>{bills.length} of {count ?? bills.length} invoices shown · billed {from} through {to}{provider ? ` · ${provider}` : " · all providers"}{(count ?? 0)>500 ? " · partial total, narrow date filters" : ""}</small></article></div>
    {canRecord ? <details><summary>Record a provider invoice</summary><form action={recordProviderInvoiceAction} className="settings-form"><div className="settings-grid">
      <label>Provider<select name="provider_key" defaultValue={provider ?? "serpapi"}>{providers.map((key) => <option key={key}>{key}</option>)}</select></label>
      <label>Unique invoice reference<input name="invoice_reference" minLength={3} maxLength={180} required /></label>
      <label>Invoice total (native USD)<input type="number" name="amount_usd" min="0" max="1000000000" step="0.01" required /></label>
      <label>Invoice issue date<input type="date" name="billed_at" max={new Date().toISOString().slice(0,10)} required /></label>
      <label>Service period from<input type="date" name="period_start" required /></label><label>Service period through<input type="date" name="period_end" required /></label>
    </div><label><input type="checkbox" name="native_usd_verified" required /> I verified this amount against a provider invoice issued in USD.</label><button className="primary-button">Record invoice</button></form></details> : <p className="page-copy">Recording and correcting invoices requires Storyloop senior finance permission.</p>}
    <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Invoice date</th><th>Provider / reference</th><th>Service period</th><th>Actual amount</th><th>Record</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id}><td>{bill.billed_at}</td><td>{bill.provider_key}<small>{bill.invoice_reference}</small></td><td>{bill.period_start} to {bill.period_end}</td><td>{money(Number(bill.amount_usd))}</td><td><small>Last recorded {new Date(bill.updated_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</small>{canRecord ? <details><summary>Correct recorded amount</summary><form action={correctProviderInvoiceAction} className="settings-form"><input type="hidden" name="bill_id" value={bill.id} /><input type="hidden" name="original_amount_usd" value={bill.amount_usd} /><label>Correct invoice total (USD)<input type="number" name="amount_usd" min="0" max="1000000000" step="0.01" defaultValue={bill.amount_usd} required /></label><label>Reason for correction<input name="correction_reason" minLength={10} maxLength={500} required /></label><label><input type="checkbox" name="native_usd_verified" required /> I checked the original USD invoice.</label><button className="secondary-button">Save audited correction</button></form></details> : null}</td></tr>)}</tbody></table></div>
    {!bills.length ? <p className="settings-notice">No provider invoices match these dates and provider. Actual subscription spend is not yet recorded.</p> : null}
  </section>;
}
