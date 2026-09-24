"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestCreatorOtp, verifyCreatorOtp } from "@/app/creator/login/actions";
import {
  completeCreatorDemoOnboarding,
  completeCreatorOnboardingPreview,
  saveCreatorOnboardingStep,
  savePrimaryCreatorProfile,
} from "@/app/creator/onboarding/actions";
import type { Json } from "@/types/database.types";

function handleFromUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1)?.replace(/^@/, "") ?? null;
  } catch {
    return null;
  }
}

export function CreatorOnboardingFlow({
  initialStep,
  initialData,
  authenticated,
  ageMethodTbd,
  demoMode,
}: {
  initialStep: number;
  initialData: Record<string, unknown>;
  authenticated: boolean;
  ageMethodTbd: boolean;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.max(1, Math.min(9, initialStep)));
  const [profileUrl, setProfileUrl] = useState(String(initialData.profileUrl ?? ""));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [previewPastTbd, setPreviewPastTbd] = useState(false);
  const [signedIn, setSignedIn] = useState(authenticated);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const handle = useMemo(() => handleFromUrl(profileUrl), [profileUrl]);

  function advance(next: number, patch: Record<string, Json> = {}) {
    setMessage(null);
    if (demoMode || !signedIn) {
      setStep(next);
      return;
    }
    startTransition(async () => {
      const result = await saveCreatorOnboardingStep(next, patch);
      if (!result.ok) {
        setMessage(result.message ?? "Could not save this step.");
        return;
      }
      setStep(next);
    });
  }

  function sendOtp() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestCreatorOtp(phone);
      if (!result.ok) setMessage(result.message ?? "Could not send OTP.");
      else setMessage("OTP sent. Enter the six digits below.");
    });
  }

  function verifyOtp() {
    setMessage(null);
    startTransition(async () => {
      const result = await verifyCreatorOtp(phone, otp, "creator_onboarding");
      if (!result.ok) {
        setMessage(result.message ?? "Could not verify OTP.");
        return;
      }
      setSignedIn(true);
      await saveCreatorOnboardingStep(4, { profileUrl, primaryHandle: handle, providerState: "not_connected" });
      await savePrimaryCreatorProfile(profileUrl, handle);
      setStep(4);
    });
  }

  const shell = (title: string, body: React.ReactNode) => (
    <section className="creator-onboarding-card" aria-live="polite">
      <div className="creator-onboarding-progress">
        <span>JOIN STORYLOOP</span>
        <span>{step}/9</span>
      </div>
      <div className="creator-chat creator-chat-sl">
        <span className="creator-chat-who">STORYLOOP</span>
        {title}
      </div>
      {body}
      {message ? <p className="creator-error" role="alert">{message}</p> : null}
    </section>
  );

  if (step === 1) return shell("Paste a link to any profile of yours.", (
    <>
      <label className="creator-field-stack">
        <span className="sr-only">Profile URL</span>
        <input type="url" placeholder="instagram.com/yourhandle" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} />
      </label>
      <button className="creator-primary" disabled={!handle} onClick={() => setStep(2)}>Find me</button>
    </>
  ));

  if (step === 2) return shell("Found the shape of your profile. Is this you?", (
    <>
      <article className="creator-profile-found">
        <span className="creator-kicker">PROVIDER NOT CONNECTED · UNVERIFIED</span>
        <strong>@{handle ?? "unknown"}</strong>
        <p>Metrics, category, city and recency will be derived when the profile provider is connected. No fictional numbers are shown.</p>
      </article>
      <div className="creator-action-row">
        <button className="creator-primary" onClick={() => setStep(3)}>Yes, that&apos;s me</button>
        <button className="creator-secondary" onClick={() => setStep(1)}>Not me</button>
      </div>
    </>
  ));

  if (step === 3 && demoMode && signedIn) return shell("Your phone is verified for this demo.", (
    <>
      <article className="creator-profile-found">
        <span className="creator-kicker">DEMO AUTHENTICATION</span>
        <strong>Phone step already completed</strong>
        <p>The demo login you just used satisfies onboarding turn 3. Production will use the same phone + OTP step with a real SMS provider.</p>
      </article>
      <button className="creator-primary" onClick={() => setStep(4)}>Continue</button>
    </>
  ));

  if (step === 3) return shell("Your phone keeps your Storyloop access with you.", (
    <div className="creator-field-stack">
      <label htmlFor="onboarding-phone">Phone</label>
      <input id="onboarding-phone" inputMode="tel" autoComplete="tel" placeholder="+91…" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button className="creator-secondary" disabled={pending} onClick={sendOtp}>Send OTP</button>
      <label htmlFor="onboarding-otp">OTP</label>
      <input id="onboarding-otp" className="creator-otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      <button className="creator-primary" disabled={pending || otp.length !== 6} onClick={verifyOtp}>{pending ? "Checking…" : "Verify & continue"}</button>
    </div>
  ));

  if (step === 4) return shell("Any other accounts we should connect?", (
    <>
      <p className="creator-muted">Up to three accounts are supported. The discovery provider is not connected, so we will not ask you to type what Storyloop should derive.</p>
      <button className="creator-primary" onClick={() => advance(5, { additionalAccounts: [] })}>Skip for now</button>
    </>
  ));

  if (step === 5) return shell("Category and city come from your content.", (
    <>
      <article className="creator-profile-found">
        <span className="creator-kicker">DERIVED INFORMATION</span>
        <strong>Provider pending</strong>
        <p>Category · city · language stay unverified until enrichment is connected.</p>
      </article>
      <button className="creator-primary" onClick={() => advance(6, { derivedProfileState: "provider_pending" })}>Continue unverified</button>
    </>
  ));

  if (step === 6 && ageMethodTbd && demoMode) return shell("18+ check", (
    <>
      <article className="creator-tbd-gate">
        <span className="creator-kicker">DEMO ONLY · O4 STILL TBD</span>
        <strong>Age verification is intentionally not decided.</strong>
        <p>For this demo we let you continue so the rest of the Creator Hub can be reviewed. No production policy has been chosen or stored.</p>
      </article>
      <button className="creator-primary" onClick={() => setStep(7)}>Continue demo</button>
    </>
  ));

  if (step === 6 && ageMethodTbd && !previewPastTbd) return shell("18+ check", (
    <>
      <article className="creator-tbd-gate">
        <span className="creator-kicker">TBD · O4</span>
        <strong>Age verification method is not decided yet.</strong>
        <p>The Product Spec explicitly leaves tap declaration vs year-of-birth vs deferred KYC open. Live onboarding must not silently choose one.</p>
      </article>
      <button className="creator-secondary" onClick={() => { setPreviewPastTbd(true); setStep(7); }}>Preview remaining turns</button>
      <p className="creator-footnote">Preview does not list the Creator or mark onboarding complete.</p>
    </>
  ));

  if (step === 6) return shell("Confirm the configured 18+ check.", (
    <button className="creator-primary" onClick={() => advance(7, { ageGate: "configured_method_completed" })}>Continue</button>
  ));

  if (step === 7) return shell("Your rate card will start from Storyloop benchmarks.", (
    <>
      <article className="creator-tbd-gate">
        <span className="creator-kicker">TBD · O5</span>
        <strong>Slider anchor is not decided.</strong>
        <p>We render the rate-card state without inventing benchmark values or choosing off-anchor vs required-touch.</p>
      </article>
      <button className="creator-primary" onClick={() => previewPastTbd ? setStep(8) : advance(8, { rateCardState: "tbd_o5" })}>Looks right</button>
    </>
  ));

  if (step === 8) return shell("Anything you won&apos;t promote?", (
    <>
      <div className="creator-chip-grid">
        {["Betting", "Tobacco", "Alcohol", "Political"].map((item) => (
          <button
            type="button"
            className="creator-chip"
            data-selected={exclusions.includes(item)}
            key={item}
            onClick={() => setExclusions((values) => values.includes(item) ? values.filter((x) => x !== item) : [...values, item])}
          >
            {item}
          </button>
        ))}
      </div>
      <button className="creator-primary" onClick={() => previewPastTbd ? setStep(9) : advance(9, { exclusions })}>Continue</button>
      <button className="creator-text-button" onClick={() => previewPastTbd ? setStep(9) : advance(9, { exclusions: [] })}>Skip</button>
    </>
  ));

  return shell("Before we list you, here is the deal.", (
    <>
      <ol className="creator-consent-lines">
        <li>Your profile can be shown to relevant brands after you consent.</li>
        <li>You control your rates, exclusions and availability.</li>
        <li>Your floor price is never shown to brands.</li>
        <li>Deal flow stays free at every tier.</li>
        <li>Studio likeness is a separate explicit consent later.</li>
        <li>You can delist and export your data.</li>
      </ol>
      <article className="creator-profile-found">
        <span className="creator-kicker">CARD AS BRANDS WILL SEE IT</span>
        <strong>@{handle ?? "creator"}</strong>
        <p>Unverified until profile enrichment and the unresolved age gate are completed.</p>
      </article>
      <button
        className="creator-primary"
        disabled={!demoMode && (previewPastTbd || pending)}
        onClick={() => startTransition(async () => {
          const result = demoMode
            ? await completeCreatorDemoOnboarding(handle)
            : await completeCreatorOnboardingPreview({
                consentVersion: "creator-v1.1",
                consentedAt: new Date().toISOString(),
              });

          if (!result.ok) {
            setMessage(result.message ?? "Could not complete onboarding.");
          } else {
            router.replace("/creator");
            router.refresh();
          }
        })}
      >
        {demoMode
          ? "Enter demo Creator Hub"
          : previewPastTbd
            ? "Live completion blocked by O4"
            : "Consent & list me"}
      </button>
    </>
  ));
}
