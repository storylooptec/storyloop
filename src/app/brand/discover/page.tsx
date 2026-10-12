import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandContext } from "@/brand/context";
import { campaignIsReadOnly, creatorBudget, DELIVERABLE_LABELS, inr } from "@/brand/planning";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "../brand.module.css";
import { selectCampaignCreatorAction } from "./actions";

type Props = { searchParams: Promise<{ campaign?: string; q?: string; city?: string; language?: string; category?: string; page?: string; error?: string; saved?: string }> };
const PAGE_SIZE = 24;
const errors: Record<string, string> = {
  quantity: "Choose a whole quantity from 1 to 100.", selection_limit: "This campaign already has 100 creator-rate selections. Remove a selection before adding another.", brief_not_approved: "Approve this campaign’s brief before selecting creators.",
  rate_unavailable: "That rate is no longer available. Review the current catalog.", creator_unavailable: "That creator is no longer available for selection.",
  read_only: "This campaign has launched or closed. Its creator selections are read-only.", campaign_read_only: "This campaign has launched or closed. Its creator selections are read-only.",
  deliverable_mismatch: "Choose a format included in this campaign’s requested deliverables.", rate_changed: "The Storyloop rate changed since this page was opened. Review the new rate before saving.",
  save: "The selection could not be saved. Please retry.",
};
const clean = (value?: string) => value?.trim().slice(0, 80) ?? "";
const pattern = (value: string) => value.replace(/[\\%_]/g, "");

export default async function BrandDiscoverPage({ searchParams }: Props) {
  const [params, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const filters = { q: clean(params.q), city: clean(params.city), language: clean(params.language), category: clean(params.category) };
  const page = Math.min(100, Math.max(0, Number.isSafeInteger(Number(params.page)) ? Number(params.page) : 0));
  const { data: campaigns, error: campaignError } = await supabase.from("brand_campaigns")
    .select("id,title,status,objective,deliverables,requested_budget_cents").eq("company_id", context.companyId).order("updated_at", { ascending: false });
  const campaign = params.campaign ? campaigns?.find((row) => row.id === params.campaign) : campaigns?.[0];
  if (params.campaign && !campaign && !campaignError) notFound();
  const readOnly = campaign ? campaignIsReadOnly(campaign.status) : false;
  let catalogQuery = supabase.from("brand_creator_catalog").select("id,display_name,bio,city,categories,languages,profile_url")
    .eq("active", true).lte("directory_consented_at", new Date().toISOString()).lte("published_at", new Date().toISOString()).order("display_name").order("id");
  if (filters.q) catalogQuery = catalogQuery.ilike("display_name", `%${pattern(filters.q)}%`);
  if (filters.city) catalogQuery = catalogQuery.ilike("city", `%${pattern(filters.city)}%`);
  if (filters.language) catalogQuery = catalogQuery.contains("languages", [filters.language]);
  if (filters.category) catalogQuery = catalogQuery.contains("categories", [filters.category]);
  const [catalogResult, planResult, selectionResult] = await Promise.all([
    catalogQuery.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    campaign ? supabase.from("brand_campaign_plans").select("approval_state").eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    campaign ? supabase.from("brand_campaign_creator_selections").select("id,catalog_id,rate_id,creator_name_snapshot,deliverable_type,quantity,unit_rate_cents,currency")
      .eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at") : Promise.resolve({ data: [], error: null }),
  ]);
  const hasNext = (catalogResult.data?.length ?? 0) > PAGE_SIZE;
  const creators = (catalogResult.data ?? []).slice(0, PAGE_SIZE);
  const { data: rates, error: rateError } = creators.length
    ? await supabase.from("brand_creator_rates").select("id,catalog_id,deliverable_type,unit_rate_cents,currency").in("catalog_id", creators.map((creator) => creator.id)).eq("active", true).order("deliverable_type")
    : { data: [], error: null };
  const selections = selectionResult.data ?? [];
  const selectedByRate = new Map(selections.map((row) => [row.rate_id, row]));
  const budget = creatorBudget(selections, campaign?.requested_budget_cents ?? null);
  const loadFailed = Boolean(campaignError || catalogResult.error || planResult.error || selectionResult.error || rateError);
  const canSelect = Boolean(campaign && planResult.data?.approval_state === "approved" && !readOnly && !loadFailed);
  const paginationHref = (targetPage: number) => {
    const query = new URLSearchParams({ ...filters, page: String(targetPage) });
    if (campaign) query.set("campaign", campaign.id);
    return `/brand/discover?${query}`;
  };

  return <BrandShell active="Discover" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Campaign workspace · Discover</p>
      <h1 className={styles.appTitle}>Find your campaign’s creators</h1>
      <p className={styles.appCopy}>Explore consented profiles, choose deliverables, and see exactly how your selected Storyloop rates add up.</p>
    </header>
    {loadFailed ? <p className={styles.error} role="alert">The directory or campaign data could not be loaded. Refresh before making selections.</p> : null}
    {params.error ? <p className={styles.error} role="alert">{errors[params.error] ?? errors.save}</p> : null}
    {params.saved ? <p className={styles.evidenceNote} role="status">Creator selections saved. Your plan budget is up to date.</p> : null}
    <section className={styles.panel} style={{ marginTop: 20 }}>
      <form method="get" className={styles.formGrid}>
        <label className={styles.field}>Campaign<select name="campaign" defaultValue={campaign?.id ?? ""}>
          {!campaigns?.length ? <option value="">No campaigns yet</option> : null}
          {campaigns?.map((row) => <option value={row.id} key={row.id}>{row.title}</option>)}
        </select></label>
        <label className={styles.field}>Creator name<input name="q" defaultValue={filters.q} maxLength={80} placeholder="Search creators" /></label>
        <label className={styles.field}>Category<input name="category" defaultValue={filters.category} maxLength={80} placeholder="e.g. Beauty" /></label>
        <label className={styles.field}>City<input name="city" defaultValue={filters.city} maxLength={80} placeholder="e.g. Mumbai" /></label>
        <label className={styles.field}>Language<input name="language" defaultValue={filters.language} maxLength={80} placeholder="e.g. Hindi" /></label>
        <div className={styles.formActions}><button type="submit" className={styles.secondaryButton}>Apply filters</button><Link href={campaign ? `/brand/discover?campaign=${campaign.id}` : "/brand/discover"} className={styles.textButton}>Clear filters</Link></div>
      </form>
    </section>
    <section className={styles.homeGrid} style={{ marginTop: 18 }}>
      <article className={styles.panel}>
        <p className={styles.eyebrow}>{campaign ? campaign.title : "Your campaign"}</p><h2 style={{ margin: 0 }}>Selected creator mix</h2>
        {campaign ? <>
          <p className={styles.muted}>Requested formats: {campaign.deliverables.map((format) => DELIVERABLE_LABELS[format] ?? format).join(" · ")}</p>
          {!canSelect && !readOnly ? <p className={styles.evidenceNote}>Approve the campaign brief in Plan to start selecting creators.</p> : null}
          {readOnly ? <p className={styles.evidenceNote}>This campaign is {campaign.status}; its rate snapshots are preserved.</p> : null}
          {selections.length ? <div className={styles.campaignList}>{selections.map((selection) => <div className={styles.campaignRow} key={selection.id}>
            <div><strong>{selection.creator_name_snapshot}</strong><div className={styles.muted}>{selection.quantity} × {DELIVERABLE_LABELS[selection.deliverable_type] ?? selection.deliverable_type} · {inr(selection.unit_rate_cents)} each</div><strong>{inr(selection.unit_rate_cents * selection.quantity)}</strong></div>
            {!readOnly && !loadFailed ? <form action={selectCampaignCreatorAction}><input type="hidden" name="campaign_id" value={campaign.id} /><input type="hidden" name="rate_id" value={selection.rate_id} /><input type="hidden" name="quantity" value="0" /><button type="submit" className={styles.textButton} aria-label={`Remove ${selection.creator_name_snapshot} ${DELIVERABLE_LABELS[selection.deliverable_type]}`}>Remove</button></form> : null}
          </div>)}</div> : <div className={styles.emptyState}>No creators selected yet.</div>}
          <Link href={`/brand/plan?campaign=${campaign.id}`} className={styles.secondaryButton} style={{ marginTop: 12 }}>Back to Plan →</Link>
        </> : <><p className={styles.muted}>Start a campaign to save creator selections.</p><Link href="/brand/campaigns/new" className={styles.primaryButton}>Start a campaign</Link></>}
      </article>
      <article className={styles.panel}>
        <p className={styles.eyebrow}>Budget check</p><div className={styles.campaignRow}><span>Requested budget</span><strong>{inr(campaign?.requested_budget_cents ?? null)}</strong></div>
        <div className={styles.campaignRow}><span>Selected creator total</span><strong>{selections.length ? inr(budget.totalCents) : "No selection"}</strong></div>
        {selections.length && budget.remainingCents !== null ? <div className={styles.campaignRow}><span>{budget.remainingCents < 0 ? "Over budget" : "Remaining budget"}</span><strong>{inr(Math.abs(budget.remainingCents))}</strong></div> : null}
        <p className={styles.muted}>Each selection saves the current Storyloop unit rate. Changing quantity uses the current published rate. Totals exclude taxes, media spend and separately quoted usage rights.</p>
        {campaign && planResult.data?.approval_state === "approved" ? <Link href={`/brand/create?campaign=${campaign.id}`} className={styles.primaryButton}>Continue to Create →</Link> : null}
      </article>
    </section>
    <section style={{ marginTop: 24 }} aria-labelledby="directory-heading"><h2 id="directory-heading">Creator directory</h2>
      {creators.length ? <div className={styles.homeGrid}>{creators.map((creator) => {
        const creatorRates = (rates ?? []).filter((rate) => rate.catalog_id === creator.id);
        return <article className={styles.panel} key={creator.id}>
          <div className={styles.campaignRow}><div><h3 style={{ margin: 0 }}>{creator.display_name}</h3><p className={styles.muted}>{[creator.city, creator.languages.join(" · ")].filter(Boolean).join(" · ")}</p></div><span className={styles.statusPill}>Storyloop directory</span></div>
          <p className={styles.muted}>{creator.bio}</p><p className={styles.muted}>{creator.categories.join(" · ")}</p>
          {creator.profile_url && /^https:\/\//i.test(creator.profile_url) ? <a href={creator.profile_url} target="_blank" rel="noreferrer" className={styles.textButton}>View public profile ↗</a> : null}
          {creatorRates.length ? creatorRates.map((rate) => {
            const matches = campaign?.deliverables.includes(rate.deliverable_type) ?? false;
            const selected = selectedByRate.get(rate.id);
            return <form action={selectCampaignCreatorAction} key={rate.id} style={{ marginTop: 18 }}>
              <input type="hidden" name="campaign_id" value={campaign?.id ?? ""} /><input type="hidden" name="rate_id" value={rate.id} /><input type="hidden" name="expected_rate_cents" value={rate.unit_rate_cents} />
              <div className={styles.campaignRow}><span>{DELIVERABLE_LABELS[rate.deliverable_type] ?? rate.deliverable_type}</span><strong>{inr(rate.unit_rate_cents)}</strong></div>
              <div className={styles.formActions}><label className={styles.field}>Quantity<input type="number" name="quantity" min="1" max="100" step="1" defaultValue={selected?.quantity ?? 1} required disabled={!canSelect || !matches} style={{ maxWidth: 100 }} /></label>
                <button type="submit" className={styles.secondaryButton} disabled={!canSelect || !matches}>{selected ? "Update selection" : "Add to campaign"}</button></div>
              {campaign && !matches ? <small className={styles.muted}>This format is outside the campaign’s requested mix.</small> : null}
            </form>;
          }) : <p className={styles.muted}>No bookable rates published yet.</p>}
        </article>;
      })}</div> : <article className={styles.panel}><h3>{Object.values(filters).some(Boolean) || page > 0 ? "No creators match these filters" : "The creator directory is being prepared"}</h3><p className={styles.muted}>{Object.values(filters).some(Boolean) || page > 0 ? "Try fewer filters or return to the first page." : "Consented profiles and Storyloop rates will appear here when they are added. You can finish your campaign brief and develop creative while the directory is empty."}</p><div className={styles.emptyState}>No creator profiles to show.</div></article>}
      {page > 0 || hasNext ? <nav aria-label="Creator directory pages" className={styles.formActions}>{page > 0 ? <Link href={paginationHref(page - 1)} className={styles.secondaryButton}>Previous</Link> : null}<span>Page {page + 1}</span>{hasNext ? <Link href={paginationHref(page + 1)} className={styles.secondaryButton}>Next</Link> : null}</nav> : null}
    </section>
  </BrandShell>;
}
