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
import { CreatorDemoStates } from "@/components/creator/creator-demo-states";
import type { Json } from "@/types/database.types";

type FetchState = "found" | "loading" | "failed" | "private" | "listed";
type AgeState = "gate" | "under18";

const fetchStates = [
  { value: "found", label: "Found" },
  { value: "loading", label: "Loading" },
  { value: "failed", label: "Failed" },
  { value: "private", label: "Private" },
  { value: "listed", label: "Already listed" },
] as const;

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
  const [fetchState, setFetchState] = useState<FetchState>("found");
  const [ageState, setAgeState] = useState<AgeState>("gate");
  const [profileUrl, setProfileUrl] = useState(String(initialData.profileUrl ?? ""));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [formats, setFormats] = useState({ reel: 15000, story: 2500, static: 8000 });
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
      else setMessage(demoMode ? "Demo OTP is 123456." : "OTP sent.");
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
      if (!demoMode) {
        await saveCreatorOnboardingStep(4, {
          profileUrl,
          primaryHandle: handle,
          providerState: "pending",
        });
        await savePrimaryCreatorProfile(profileUrl, handle);
      }
      setStep(4);
    });
  }

  const shell = (title: string, body: React.ReactNode) => (
    <section className="creator-onboarding-card" aria-live="polite">
      <div className="creator-onboarding-progress">
        <span>{step === 7 ? "YOUR RATES" : step === 9 ? "DONE" : "JOIN STORYLOOP"}</span>
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

  if (step === 1) {
    return shell("Paste a link to any profile of yours.", (
      <>
        <label className="creator-field-stack">
          <span className="sr-only">Profile URL</span>
          <input
            type="url"
            placeholder="instagram.com/sneha.patil"
            value={profileUrl}
            onChange={(event) => setProfileUrl(event.target.value)}
          />
        </label>
        <button
          className="creator-primary"
          disabled={!handle}
          onClick={() => {
            setFetchState("loading");
            setStep(2);
            window.setTimeout(() => setFetchState("found"), 700);
          }}
        >
          Find me
        </button>
      </>
    ));
  }

  if (step === 2) {
    return shell(
      fetchState === "loading"
        ? "Looking you up…"
        : fetchState === "found"
          ? "Found you. Is this right?"
          : fetchState === "failed"
            ? "Couldn’t reach that profile. Tell me the basics and we’ll verify later."
            : fetchState === "private"
              ? "That account is private, so we can’t read it."
              : "You’re already on Storyloop. Let’s sign you in instead — no duplicates.",
      (
        <>
          {demoMode ? <CreatorDemoStates value={fetchState} options={fetchStates} onChange={setFetchState} /> : null}

          {fetchState === "loading" ? (
            <article className="creator-profile-skeleton">
              <span className="creator-kicker">FETCHING</span>
              <div />
              <div />
              <div />
              <p>Skeleton card holds the space. Failed branch takes over after a short wait.</p>
            </article>
          ) : null}

          {fetchState === "found" ? (
            <>
              <article className="creator-profile-found">
                <span className="creator-kicker">{demoMode ? "FETCHED · DEMO PUBLIC DATA" : "FETCHED · PUBLIC DATA"}</span>
                <strong>Sneha Patil · @{handle ?? "sneha.patil"}</strong>
                <dl className="creator-kv">
                  <div><dt>Followers</dt><dd>48,200</dd></div>
                  <div><dt>Avg likes</dt><dd>2,840</dd></div>
                  <div><dt>Engagement</dt><dd>6.27%</dd></div>
                </dl>
              </article>
              <div className="creator-action-row">
                <button className="creator-primary" onClick={() => setStep(3)}>Yes, that&apos;s me</button>
                <button className="creator-secondary" onClick={() => setStep(1)}>Not me</button>
              </div>
            </>
          ) : null}

          {fetchState === "failed" ? (
            <>
              <article className="creator-wire-card">
                <span className="creator-kicker">MANUAL · FLAGGED UNVERIFIED</span>
                <strong>Sneha Patil · Fitness · Mumbai</strong>
                <p>Record stays unverified until a provider or OAuth connect confirms it.</p>
              </article>
              <button className="creator-primary" onClick={() => setStep(3)}>Continue</button>
            </>
          ) : null}

          {fetchState === "private" ? (
            <>
              <div className="creator-action-stack">
                <button className="creator-primary" onClick={() => setFetchState("loading")}>Make it public, retry</button>
                <button className="creator-secondary" onClick={() => setFetchState("failed")}>Enter details manually</button>
              </div>
              <p className="creator-footnote">Manual path remains unverified until confirmed later.</p>
            </>
          ) : null}

          {fetchState === "listed" ? (
            <button className="creator-primary" onClick={() => router.push("/creator/login")}>Sign in →</button>
          ) : null}
        </>
      ),
    );
  }

  if (step === 3 && demoMode && signedIn) {
    return shell("Where do we message you when a brand wants you?", (
      <>
        <article className="creator-wire-card">
          <span className="creator-kicker">DEMO AUTHENTICATION</span>
          <strong>Phone already verified</strong>
          <p>Your demo sign-in satisfies this turn. Production uses SMS auto-read and auto-submit.</p>
        </article>
        <button className="creator-primary" onClick={() => setStep(4)}>Continue</button>
      </>
    ));
  }

  if (step === 3) {
    return shell("Where do we message you when a brand wants you?", (
      <div className="creator-field-stack">
        <label htmlFor="onboarding-phone">Phone</label>
        <input
          id="onboarding-phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <button className="creator-secondary" disabled={pending} onClick={sendOtp}>Send OTP</button>
        <label htmlFor="onboarding-otp">OTP</label>
        <input
          id="onboarding-otp"
          className="creator-otp-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <button className="creator-primary" disabled={pending || otp.length !== 6} onClick={verifyOtp}>
          {pending ? "Checking…" : "Verify & continue"}
        </button>
      </div>
    ));
  }

  if (step === 4) {
    return shell("Anywhere else brands should see? Up to three.", (
      <>
        <div className="creator-account-picks">
          <button type="button" data-selected="true">Instagram ✓</button>
          <button type="button">YouTube</button>
          <button type="button">Moj</button>
        </div>
        <button className="creator-text-button" onClick={() => advance(5, { additionalAccounts: [] })}>Skip for now</button>
      </>
    ));
  }

  if (step === 5) {
    return shell("Reading your posts: fitness, Mumbai, mostly Hindi + English. Right?", (
      <>
        <article className="creator-wire-card">
          <dl className="creator-kv">
            <div><dt>Category</dt><dd>Fitness</dd></div>
            <div><dt>City</dt><dd>Mumbai</dd></div>
            <div><dt>Language</dt><dd>HI · EN</dd></div>
          </dl>
          {demoMode ? <small>Illustrative demo derivation</small> : null}
        </article>
        <div className="creator-action-row">
          <button className="creator-primary" onClick={() => advance(6, { category: "Fitness", city: "Mumbai", languages: ["HI","EN"] })}>That&apos;s right</button>
          <button className="creator-secondary">Change</button>
        </div>
      </>
    ));
  }

  if (step === 6 && ageState === "under18") {
    return shell("Not yet", (
      <>
        <article className="creator-tbd-gate">
          <span className="creator-kicker">TBD · O9</span>
          <strong>We can&apos;t list you before 18.</strong>
          <p>Retention policy is unresolved. This demo shows the wireframe&apos;s delete-now assumption without making it a production rule.</p>
        </article>
        <button className="creator-secondary" onClick={() => setAgeState("gate")}>Back to demo</button>
      </>
    ));
  }

  if (step === 6) {
    return shell("Brand deals are contracts, so we need this one straight: are you 18 or older?", (
      <>
        <div className="creator-action-row">
          <button className="creator-primary" onClick={() => setStep(7)}>Yes, 18+</button>
          <button className="creator-secondary" onClick={() => setAgeState("under18")}>Not yet</button>
        </div>
        <article className="creator-tbd-gate">
          <span className="creator-kicker">TBD · O4</span>
          <p>{ageMethodTbd ? "Tap declaration vs year-of-birth chip vs deferred KYC remains unresolved." : "Configured age verification applies in production."}</p>
        </article>
      </>
    ));
  }

  if (step === 7) {
    return shell("Fitness creators in Mumbai around your size charge about this. Drag anything that’s wrong.", (
      <>
        <div className="creator-rate-editor">
          {([
            ["Reel","reel",5000,50000,1000],
            ["Story","story",500,10000,500],
            ["Static","static",2000,25000,500],
          ] as const).map(([label,key,min,max,stepValue]) => (
            <label key={key}>
              <span>{label}</span>
              <strong>₹{formats[key].toLocaleString("en-IN")}</strong>
              <input
                type="range"
                min={min}
                max={max}
                step={stepValue}
                value={formats[key]}
                onChange={(event) => setFormats((current) => ({ ...current, [key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        <p className="creator-footnote">Position carries the signal — no state colours. Anchor method remains TBD O5.</p>
        <div className="creator-action-row">
          <button className="creator-primary" onClick={() => advance(8, { askedRates: formats })}>Looks right</button>
          <button className="creator-secondary">Add formats</button>
        </div>
      </>
    ));
  }

  if (step === 8) {
    const chips = ["Betting", "Tobacco", "Alcohol", "Crypto", "Fairness creams", "None"];
    return shell("Anything you won’t promote? Brands never see rejected categories as yours.", (
      <>
        <div className="creator-chip-grid">
          {chips.map((item) => (
            <button
              type="button"
              className="creator-chip"
              data-selected={exclusions.includes(item)}
              key={item}
              onClick={() => {
                if (item === "None") setExclusions(["None"]);
                else setExclusions((values) => {
                  const clean = values.filter((value) => value !== "None");
                  return clean.includes(item) ? clean.filter((value) => value !== item) : [...clean, item];
                });
              }}
            >
              {item}{exclusions.includes(item) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <button className="creator-primary" onClick={() => advance(9, { exclusions })}>Continue</button>
      </>
    ));
  }

  return shell("Six lines. Non-exclusive, we show your public numbers and rates, you can leave anytime.", (
    <>
      <ol className="creator-consent-lines">
        <li>Your public creator profile and agreed rates can be shown to relevant brands.</li>
        <li>You control availability, exclusions and the rates you ask.</li>
        <li>Your private floor price is never shown to brands.</li>
        <li>Deal flow and getting paid remain free at every tier.</li>
        <li>Studio likeness consent is separate and revocable.</li>
        <li>You can delist and export your data.</li>
      </ol>
      <article className="creator-profile-found">
        <span className="creator-kicker">YOUR CARD · AS BRANDS SEE IT</span>
        <strong>Sneha Patil · Fitness · Mumbai</strong>
        <p>48.2K · 6.27% ER · Reel ₹{formats.reel.toLocaleString("en-IN")}</p>
      </article>
      <button
        className="creator-primary"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = demoMode
            ? await completeCreatorDemoOnboarding(handle)
            : await completeCreatorOnboardingPreview({
                consentVersion: "creator-v1.1",
                consentedAt: new Date().toISOString(),
              });
          if (!result.ok) setMessage(result.message ?? "Could not complete onboarding.");
          else {
            router.replace("/creator");
            router.refresh();
          }
        })}
      >
        {pending ? "Listing…" : "I agree — list me"}
      </button>
    </>
  ));
}
