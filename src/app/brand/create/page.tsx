import Link from "next/link";
import { SubmitButton } from "@/components/brand/submit-button";
import Image from "next/image";
import { requireBrandContext } from "@/brand/context";
import { CONCEPT_LIMITS, MUTABLE_CAMPAIGN_STATES, readConcepts } from "@/brand/creative";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { higgsfieldConfiguration } from "@/lib/providers/higgsfield";
import { approveCampaignCreativeAction, generateCampaignScriptsAction, quoteCampaignPreviewAction, recoverCampaignPreviewAction, refreshCampaignPreviewAction, requestCampaignPreviewAction, submitCampaignPreviewAction, updateCampaignConceptAction } from "./actions";
import styles from "../brand.module.css";

export const maxDuration = 300;

type Props = { searchParams: Promise<{ campaign?: string; error?: string; notice?: string }> };
const errors: Record<string, string> = {
  approval: "Approve the campaign brief before generating scripts.", creative_approval: "Approve a current creative set before preparing a preview.",
  read_only: "This campaign is read-only after launch or archiving.", stale: "The brief or creative changed. Reload before editing or approving again.",
  confirm_approval: "Confirm that you have reviewed the saved version of all three concepts.", campaign: "Select a campaign you can access.",
  provider_not_configured: "AI generation is not configured in this environment.", provider_disabled: "This provider is currently disabled.",
  provider_rate_limited: "The provider is busy. Wait before trying again.", provider_failed: "The provider could not complete this request.",
  provider_invalid_output: "The generated response did not meet the required format. It was not saved as a usable creative.",
  submission_unknown: "The provider may have accepted this request. It will not be resubmitted automatically. Ask an administrator to reconcile the request ID shown below.",
  usage_reservation_failed: "Usage controls are unavailable. No new generation was started.", app_rate_limit: "The generation limit has been reached. Try again later.",
  concurrency_limit: "Another generation is already in progress. Wait before starting another.", spend_limit: "This request exceeds the configured API spend limit.",
  provider_circuit_open: "The provider is temporarily paused after repeated errors.", save_failed: "Your changes could not be saved. Check the fields and try again.",
  prompt: "Enter a preview prompt between 20 and 4,000 characters.", likeness: "Confirm that a generic preview will not depict or imitate a real person.",
  creator_unavailable: "Select an available creator from this campaign’s approved directory selection.", creator_video_unsupported: "Creator likeness previews currently support images. Video previews use generic scenes only.",
  consent: "Permission has expired, changed or been revoked. Prepare a new request for the creator to review.", consent_revoked: "The creator revoked permission before submission.",
  preview_configuration: "The preview provider or private media storage still needs administrator configuration.", preview_exists: "A quote or job already exists for this exact request. Check its status below.",
  recovery_unavailable: "The original recovery window has closed. An administrator must reconcile this job before another generation is attempted.", operation_running: "A request is already in progress. Wait before continuing.", app_hourly_limit: "This campaign has reached its hourly generation limit.", app_daily_limit: "This workspace has reached its daily generation limit.", daily_spend_limit: "This request exceeds the configured daily spend cap.", cost_estimate_required: "An administrator must configure model pricing before generation can use a spend cap.", unreconciled_costs: "Earlier request costs need reconciliation before more paid generation.",
  preview_unavailable: "This preview is unavailable or no longer editable.", quote_expired: "The 10-minute quote expired. Prepare a new preview request to obtain a fresh quote.",
  preview_cost_limit: "The estimated price exceeds the configured per-preview limit. No generation was submitted.", confirm_cost: "Review and confirm the displayed quote before submitting.",
  archive_pending: "Generation finished, but the media could not yet be saved to private storage. Refresh to retry storage; this does not regenerate or charge for a new job.",
  poll_cooldown: "Wait at least 10 seconds between status refreshes.", request_limit: "This workspace has reached its preview request limit for today.",
};
const notices: Record<string, string> = { generated: "Three draft concepts are ready for review.", saved: "Edits saved as a new revision. Approval and previous preview permissions have been reset.", approved: "The saved creative set is approved.", consent_requested: "The request is now in the creator’s Brand requests inbox.", preview_prepared: "Preview prepared. Get a price quote before generating.", quoted: "Review the estimated price and confirm before generation.", submitted: "The preview is queued. Refresh its status below.", refreshed: "Preview status updated." };

export default async function BrandCreatePage({ searchParams }: Props) {
  const [params, context] = await Promise.all([searchParams, requireBrandContext()]);
  const db = await createServerSupabaseClient();
  const { data: campaigns, error: campaignError } = await db.from("brand_campaigns").select("id,title,status,objective,deliverables").eq("company_id", context.companyId).order("updated_at", { ascending: false }).limit(100);
  const campaign = params.campaign ? campaigns?.find((item) => item.id === params.campaign) : campaigns?.find((item) => item.status === "ready_for_desk") ?? campaigns?.[0];
  const [{ data: plan }, { data: creatives }, { data: requests }, { data: jobs }, { data: selections }] = campaign ? await Promise.all([
    db.from("brand_campaign_plans").select("approval_state,revision").eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle(),
    db.from("brand_campaign_creatives").select("*").eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(10),
    db.from("brand_preview_requests").select("*").eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(30),
    db.from("brand_preview_jobs").select("*").eq("campaign_id", campaign.id).eq("company_id", context.companyId).order("created_at", { ascending: false }).limit(30),
    db.from("brand_campaign_creator_selections").select("catalog_id,creator_name_snapshot").eq("campaign_id", campaign.id).eq("company_id", context.companyId),
  ]) : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const readOnly = !campaign || !MUTABLE_CAMPAIGN_STATES.has(campaign.status);
  const preview = higgsfieldConfiguration();
  const currentCreative = creatives?.find((creative) => creative.approval_state === "approved" && creative.plan_revision === plan?.revision && plan?.approval_state === "approved");

  // eslint-disable-next-line react-hooks/purity -- Authenticated server render uses one request timestamp; actions independently enforce expiry.
  const renderedAt = Date.now();
  return <BrandShell active="Create" companyName={context.companyName} email={context.email}>
    <header><p className={styles.eyebrow}>Campaign workspace · Create</p><h1 className={styles.appTitle}>Make an idea worth sharing.</h1>
      <p className={styles.appCopy}>Turn your approved brief into angles, hooks and scripts. Review the creative, then make an optional preview.</p></header>
    {params.error || campaignError ? <p className={styles.error} role="alert">{errors[params.error ?? ""] ?? "This action could not be completed. Your saved work is preserved; refresh and try again."}</p> : null}
    {params.notice ? <p className={styles.evidenceNote} role="status">{notices[params.notice] ?? "Saved."}</p> : null}
    {campaigns?.length ? <form method="get" className={styles.panel} style={{ display: "flex", gap: 12, alignItems: "end", marginTop: 22 }}><label className={styles.field} style={{ flex: 1 }}>Campaign<select name="campaign" defaultValue={campaign?.id}>{campaigns.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label><button className={styles.secondaryButton}>Open campaign</button></form> : null}
    {campaign ? <>
      <section className={styles.panel} style={{ marginTop: 20 }}><p className={styles.eyebrow}>{campaign.status.replaceAll("_", " ")}</p><h2>{campaign.title}</h2><p className={styles.muted}>{campaign.objective} · {campaign.deliverables.join(", ")}</p>
        {readOnly ? <p className={styles.evidenceNote}>This campaign is read-only. Existing approved content remains available for review.</p> : plan?.approval_state === "approved" ? <form action={generateCampaignScriptsAction}><input type="hidden" name="campaign_id" value={campaign.id}/><SubmitButton className={styles.primaryButton} pendingLabel="Writing concepts…">Generate 3 concepts</SubmitButton><p className={styles.muted}>Uses the approved brief, revision {plan.revision}. AI generation counts toward this campaign’s usage limit.</p></form>
          : <p className={styles.evidenceNote}>An approved brief unlocks creative generation. <Link href={`/brand/plan?campaign=${campaign.id}`}>Review the plan →</Link></p>}
      </section>
      {creatives?.map((creative, setIndex) => {
        const current = creative.plan_revision === plan?.revision && plan?.approval_state === "approved";
        return <section className={styles.panel} key={creative.id} style={{ marginTop: 20 }}>
          <p className={styles.eyebrow}>{setIndex === 0 ? "Latest creative set" : "Earlier creative set"} · Revision {creative.revision} · {current ? creative.approval_state : "Brief changed"}</p>
          <p className={styles.muted}>{new Date(creative.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · Based on brief revision {creative.plan_revision ?? "unknown"}</p>
          {!current ? <p className={styles.evidenceNote}>This set uses an earlier brief. Generate a new set from the current approved brief.</p> : null}
          <div className={styles.homeGrid}>{readConcepts(creative.content).map((concept, index) => <article className={styles.panel} key={index}>
            <h3>Concept {index + 1}</h3><form action={updateCampaignConceptAction} className={styles.formWrap}>
              <input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="creative_id" value={creative.id}/><input type="hidden" name="revision" value={creative.revision}/><input type="hidden" name="concept_index" value={index}/>
              {(["format", "angle", "hook", "script", "cta"] as const).map((key) => <label className={styles.field} key={key}>{({ format: "Format", angle: "Campaign angle", hook: "Opening hook", script: "Script", cta: "Call to action" })[key]}<textarea name={key} defaultValue={concept[key]} key={`${creative.revision}-${key}`} maxLength={CONCEPT_LIMITS[key]} rows={key === "script" ? 7 : 2} required readOnly={readOnly || !current}/></label>)}
              {!readOnly && current ? <button className={styles.secondaryButton}>Save concept as new revision</button> : null}
            </form></article>)}</div>
          {!readOnly && current && creative.approval_state !== "approved" ? <form action={approveCampaignCreativeAction} style={{ marginTop: 20 }}>
            <input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="creative_id" value={creative.id}/><input type="hidden" name="revision" value={creative.revision}/>
            <label style={{ display: "flex", gap: 10, marginBottom: 14 }}><input type="checkbox" name="confirm_saved" value="yes" required/><span>I have saved my edits and reviewed all three concepts in revision {creative.revision}.</span></label>
            <button className={styles.primaryButton}>Approve saved revision {creative.revision}</button>
          </form> : null}
        </section>;
      })}
      {currentCreative ? <section className={styles.panel} style={{ marginTop: 20 }}><p className={styles.eyebrow}>Ready for review</p><h2>Your campaign creative is approved.</h2><p className={styles.muted}>Previews are optional. Review the selected creators and budget before launch.</p><Link className={styles.secondaryButton} href={`/brand/campaigns/${campaign.id}/manage`}>Review campaign and launch →</Link></section> : null}
      <section className={styles.panel} style={{ marginTop: 20 }}><p className={styles.eyebrow}>Optional · AI preview</p><h2>See the idea take shape.</h2><p className={styles.muted}>Generic product image or 5-second silent product video, or an image using a selected creator’s explicitly approved photo. Each request has a price quote before generation.</p>
        {!preview.ready ? <p className={styles.evidenceNote}>{preview.reason}</p> : null}
        {!readOnly && currentCreative ? <form action={requestCampaignPreviewAction} className={styles.formWrap}>
          <input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="creative_id" value={currentCreative.id}/>
          <label className={styles.field}>Preview type<select name="kind"><option value="image">Image · portrait 9:16</option><option value="video">Generic video · 5 seconds · silent</option></select></label>
          <label className={styles.field}>Subject<select name="catalog_id" defaultValue=""><option value="">Generic product scene · no people</option>{[...new Map(selections?.map((selection) => [selection.catalog_id, selection])).values()].map((selection) => <option key={selection.catalog_id} value={selection.catalog_id}>{selection.creator_name_snapshot} · request image permission</option>)}</select></label>
          <label className={styles.field}>Exact preview prompt<textarea name="prompt" rows={5} minLength={20} maxLength={4000} required placeholder="Describe the scene, product, action, lighting and composition. For creator previews, this exact text will be shown to the creator."/></label>
          <label style={{ display: "flex", gap: 10 }}><input type="checkbox" name="no_likeness" value="yes"/><span>For a generic preview, I confirm this prompt is for products, props and environments, without people or voices.</span></label>
          <button className={styles.secondaryButton}>Prepare preview request</button><p className={styles.muted}>This step does not submit a paid generation. Creator requests appear in their Brand requests inbox and expire after 7 days.</p>
        </form> : <p className={styles.evidenceNote}>Approve a current creative set to prepare previews.</p>}
      </section>
      <div className={styles.campaignList} style={{ marginTop: 20 }}>{requests?.map((request) => {
        const job = jobs?.find((entry) => entry.request_id === request.id);
        const expired = Date.parse(request.expires_at) <= renderedAt;
        const accessible = request.status === "approved" && !expired;
        const canAct = !readOnly && accessible && preview.ready;
        const quoteValid = job?.status === "quoted" && Date.parse(job.quote_expires_at) > renderedAt;
        return <section className={styles.panel} key={request.id}><p className={styles.eyebrow}>{request.kind} preview · {expired ? "Permission expired" : request.status.replaceAll("_", " ")}</p><p style={{ whiteSpace: "pre-wrap" }}>{request.prompt}</p><p className={styles.muted}>{request.creator_id ? "Creator permission required for this exact prompt and photo." : "Generic scene · no creator likeness"} · Creative revision {request.creative_revision}</p>
          {canAct && !job ? <form action={quoteCampaignPreviewAction}><input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="request_id" value={request.id}/><SubmitButton className={styles.secondaryButton} pendingLabel="Getting price…">Get price quote</SubmitButton></form> : null}
          {job ? <><p><strong>{job.status.replaceAll("_", " ")}</strong> · Estimated generation cost ${Number(job.estimated_cost_usd).toFixed(4)} USD</p>
            {job.provider_request_id ? <p className={styles.muted}>Provider request: {job.provider_request_id}</p> : null}
            {job.status === "submission_unknown" || job.status === "submitting" && renderedAt - Date.parse(job.updated_at) > 60000 ? <p className={styles.evidenceNote}>Submission needs reconciliation. Do not prepare a replacement: the provider may already be generating it. Storyloop job ID: {job.id}.</p> : null}
            {canAct && Date.parse(job.quote_expires_at) > renderedAt && (job.status === "submission_unknown" || job.status === "submitting" && renderedAt - Date.parse(job.updated_at) >= 5 * 60000) ? <form action={recoverCampaignPreviewAction}><input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="request_id" value={request.id}/><SubmitButton className={styles.secondaryButton} pendingLabel="Recovering original request…">Recover original submission</SubmitButton><p className={styles.muted}>Uses the original request and payment approval with the same provider idempotency key. It cannot create a second copy of an accepted job.</p></form> : null}
            {job.status === "quoted" && !quoteValid ? <p className={styles.muted}>Quote expired. Prepare a new request to obtain a current price.</p> : null}
            {canAct && quoteValid ? <form action={submitCampaignPreviewAction}><input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="quoted_cost" value={job.estimated_cost_usd}/><label style={{ display: "flex", gap: 10, marginBottom: 12 }}><input type="checkbox" name="confirm_cost" value="yes" required/><span>I approve one generation at the estimated ${Number(job.estimated_cost_usd).toFixed(4)} USD. Final billing is reconciled separately.</span></label><SubmitButton className={styles.primaryButton} pendingLabel="Submitting preview…">Generate this preview</SubmitButton></form> : null}
            {accessible && preview.ready && ["queued", "in_progress", "completed_pending_archive", "submission_unknown"].includes(job.status) ? <form action={refreshCampaignPreviewAction}><input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="job_id" value={job.id}/><button className={styles.secondaryButton}>{job.status === "completed_pending_archive" ? "Retry saving preview" : "Refresh status"}</button><p className={styles.muted}>Refresh at most every 10 seconds. This does not start another generation.</p></form> : null}
            {job.status === "completed" && accessible ? <><p className={styles.eyebrow}>AI-generated preview · internal review</p>{job.kind === "video" ? <video src={`/brand/create/media/${job.id}`} controls preload="metadata" style={{ maxWidth: 360, width: "100%", borderRadius: 12 }} /> : <Link href={`/brand/create/media/${job.id}`} target="_blank" rel="noopener noreferrer"><Image src={`/brand/create/media/${job.id}`} alt="AI-generated campaign concept preview" width={360} height={640} unoptimized style={{ maxWidth: 360, width: "100%", height: "auto", borderRadius: 12 }}/></Link>}</> : null}
          </> : null}
        </section>;
      })}</div>
    </> : <section className={styles.panel} style={{ marginTop: 24 }}><h2>Start with a campaign brief.</h2><p className={styles.muted}>Your campaign concepts and previews will appear here once the plan is approved.</p><Link href="/brand/plan" className={styles.secondaryButton}>Go to Plan →</Link></section>}
  </BrandShell>;
}
