import { storageConfigured } from "@/lib/storage/config";
import Link from "next/link";
import { SubmitButton } from "@/components/brand/submit-button";
import { requireCreatorContext } from "@/creator/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respondToBrandPreviewAction } from "./actions";
import styles from "../../brand/brand.module.css";

export const maxDuration = 300;

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };
export default async function CreatorBrandRequestsPage({ searchParams }: Props) {
  const [context, params] = await Promise.all([requireCreatorContext(), searchParams]);
  const db = await createServerSupabaseClient();
  const storageReady = storageConfigured();
  const { data: requests, error } = context.demoMode ? { data: [], error: null } : await db.from("brand_preview_requests").select("*").eq("creator_id", context.account.creator_id).order("created_at", { ascending: false }).limit(50);
  const { data: jobs } = !context.demoMode && requests?.length ? await db.from("brand_preview_jobs").select("id,request_id,status,kind").in("request_id", requests.map((request) => request.id)) : { data: [] };
  // eslint-disable-next-line react-hooks/purity -- Authenticated server render uses one request timestamp; actions independently enforce expiry.
  const renderedAt = Date.now();
  return <main className={styles.publicPage} style={{ padding: "32px clamp(20px, 5vw, 80px)", minHeight: "100vh" }}>
    <Link href="/creator">← Creator home</Link>
    <header style={{ marginTop: 28, maxWidth: 760 }}><p className={styles.eyebrow}>Your likeness · Your choice</p><h1 className={styles.appTitle}>Brand preview requests</h1>
      <p className={styles.appCopy}>Review each exact campaign prompt before approving an AI image using your photo. Permission applies to this one internal preview. It does not authorize posting, advertising, voice cloning or future campaigns.</p></header>
    {params.error || error ? <p className={styles.error} role="alert">{params.error === "demo" ? "Real approval requires a verified creator account." : params.error === "photo" ? "Use a valid PNG, JPG or WebP photo up to 5 MB. Your approval was not saved." : "The request changed or could not be saved. Refresh and review it again."}</p> : null}
    {params.saved ? <p className={styles.evidenceNote} role="status">Your choice has been saved.</p> : null}
    {!requests?.length ? <section className={styles.panel} style={{ marginTop: 24 }}><h2>No preview requests yet</h2><p className={styles.muted}>Requests from brands will appear here when they select you for a campaign.</p></section> : null}
    <div className={styles.campaignList} style={{ marginTop: 24 }}>{requests?.map((request) => {
      const expired = Date.parse(request.expires_at) <= renderedAt;
      const job = jobs?.find((entry) => entry.request_id === request.id);
      return <article className={styles.panel} key={request.id}>
        <p className={styles.eyebrow}>{request.brand_name} · {expired ? "Expired" : request.status.replaceAll("_", " ")}</p>
        <h2>{request.campaign_title}</h2>
        <p className={styles.muted}>Image preview · Creative revision {request.creative_revision} · Permission expires {new Date(request.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        <h3>Exact generation prompt</h3><p style={{ whiteSpace: "pre-wrap" }}>{request.prompt}</p>
        <p className={styles.muted}>Your selected image and this prompt will be sent to Higgsfield for generation. The brand can review the result inside Storyloop. Editing the brief, script or prompt requires a new request.</p>
        {request.status === "awaiting_consent" && !expired ? <>
          {!storageReady ? <p className={styles.evidenceNote}>Photo approval will be available when Storyloop finishes configuring private preview storage. You can still decline this request.</p> : null}
          <form action={respondToBrandPreviewAction} className={styles.formWrap}>
            <input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="request_hash" value={request.request_hash}/><input type="hidden" name="decision" value="approve"/>
            <label className={styles.field}>Your reference photo<input type="file" name="reference_photo" accept="image/png,image/jpeg,image/webp" required/><span>PNG, JPG or WebP · up to 5 MB. Use a photo showing only you.</span></label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" name="consent" value="yes" required/><span>I own or have permission to use this photo, it depicts me, and I approve exactly this prompt and uploaded photo for one internal image preview for {request.brand_name}. I understand AI can alter my appearance.</span></label>
            <SubmitButton disabled={!storageReady} className={styles.primaryButton} pendingLabel="Saving your permission…">Approve this preview with my photo</SubmitButton>
          </form>
          <form action={respondToBrandPreviewAction} style={{ marginTop: 12 }}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="request_hash" value={request.request_hash}/><button className={styles.secondaryButton} name="decision" value="reject">Decline request</button></form>
        </> : null}
        {request.status === "approved" ? <>
          {job?.status === "completed" && !expired ? <p><Link href={`/brand/create/media/${job.id}`} target="_blank" rel="noopener noreferrer">View generated preview ↗</Link></p> : null}
          <form action={respondToBrandPreviewAction}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="request_hash" value={request.request_hash}/><button className={styles.secondaryButton} name="decision" value="revoke">Revoke this permission</button></form>
          <p className={styles.muted}>Revocation blocks new generation and access to the preview in Storyloop. A job already sent to Higgsfield may finish; files previously downloaded cannot be recalled.</p>
        </> : null}
      </article>;
    })}</div>
  </main>;
}
