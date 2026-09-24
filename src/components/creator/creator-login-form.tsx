"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestCreatorOtp, verifyCreatorOtp } from "@/app/creator/login/actions";
import { CreatorDemoStates } from "@/components/creator/creator-demo-states";

type DemoState = "device" | "unknown" | "changed" | "whatsapp";

const demoStates = [
  { value: "device", label: "New device" },
  { value: "unknown", label: "Unknown number" },
  { value: "changed", label: "Changed phone" },
  { value: "whatsapp", label: "WhatsApp link" },
] as const;

export function CreatorLoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [demoState, setDemoState] = useState<DemoState>("device");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(20);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (demoMode || stage !== "otp" || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [demoMode, stage, resendIn]);

  function send() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestCreatorOtp(phone);
      if (!result.ok) {
        setMessage(result.message ?? "Could not send OTP.");
        return;
      }
      setStage("otp");
      setResendIn(20);
    });
  }

  function verify() {
    setMessage(null);
    startTransition(async () => {
      const result = await verifyCreatorOtp(phone, otp);
      if (!result.ok) {
        setMessage(result.message ?? "Could not verify OTP.");
        return;
      }
      router.replace(result.next ?? "/creator");
      router.refresh();
    });
  }

  const authForm = (
    <>
      <p className="creator-kicker">{demoMode ? "CREATOR SIGN IN · DEMO" : "CREATOR SIGN IN"}</p>
      <h1>The notification is the login.</h1>
      <p className="creator-muted">No passwords. Returning sessions go straight into Storyloop.</p>

      {demoMode ? (
        <div className="creator-demo-auth-note">
          <strong>Demo authentication</strong>
          <span>No SMS is sent. Use OTP <b>123456</b>.</span>
        </div>
      ) : null}

      {stage === "phone" ? (
        <div className="creator-field-stack">
          <label htmlFor="creator-phone">What&apos;s your number?</label>
          <input id="creator-phone" inputMode="tel" autoComplete="tel" placeholder="+91…" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <button className="creator-primary" type="button" disabled={pending} onClick={send}>
            {pending ? "Continuing…" : "Send OTP"}
          </button>
        </div>
      ) : (
        <div className="creator-field-stack">
          <div className="creator-auth-context">
            <span>{demoMode ? "Demo OTP for" : "OTP sent to"}</span>
            <strong>{phone}</strong>
            <button type="button" onClick={() => setStage("phone")}>Change</button>
          </div>
          <label htmlFor="creator-otp">Six-digit OTP</label>
          <input id="creator-otp" className="creator-otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button className="creator-primary" type="button" disabled={pending || otp.length !== 6} onClick={verify}>
            {pending ? "Checking…" : "Continue"}
          </button>
          {!demoMode ? (
            <button className="creator-text-button" type="button" disabled={pending || resendIn > 0} onClick={send}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
            </button>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div className="creator-auth-card">
      {demoMode ? <CreatorDemoStates value={demoState} options={demoStates} onChange={setDemoState} /> : null}

      {demoState === "device" || !demoMode ? authForm : null}

      {demoMode && demoState === "unknown" ? (
        <>
          <p className="creator-kicker">STATE · NUMBER NOT RECOGNISED</p>
          <h1>That number isn&apos;t on Storyloop.</h1>
          <div className="creator-chat creator-chat-sl">
            <span className="creator-chat-who">STORYLOOP</span>
            Don&apos;t know that number. What&apos;s your Instagram handle? That works too.
          </div>
          <div className="creator-field-stack">
            <label htmlFor="recover-handle">Instagram handle</label>
            <input id="recover-handle" placeholder="@sneha.patil" value={handle} onChange={(event) => setHandle(event.target.value)} />
            <button className="creator-primary" disabled={!handle.trim()}>Continue recovery</button>
          </div>
          <p className="creator-footnote">The handle is the second key — never a dead end, never “contact support”.</p>
        </>
      ) : null}

      {demoMode && demoState === "changed" ? (
        <>
          <p className="creator-kicker">STATE · CHANGED PHONE RECOVERY</p>
          <h1>New number?</h1>
          <div className="creator-chat creator-chat-sl">
            <span className="creator-chat-who">STORYLOOP</span>
            Prove the account is yours one of two ways.
          </div>
          <div className="creator-action-stack">
            <button className="creator-secondary">DM code to @sneha.patil</button>
            <button className="creator-secondary">Put a temporary string in your bio</button>
          </div>
          <p className="creator-footnote">Confirmed → new number binds, old number drops.</p>
        </>
      ) : null}

      {demoMode && demoState === "whatsapp" ? (
        <>
          <p className="creator-kicker">90% OF SESSIONS · WHATSAPP SIGNED LINK</p>
          <h1>Tap → straight into the brief.</h1>
          <article className="creator-wire-card accent">
            <span className="creator-kicker">WHATSAPP · STORYLOOP</span>
            <strong>GlowFit wants a reel.</strong>
            <p>₹15,000 · live by 28 Sep</p>
            <Link className="creator-primary creator-inline-button" href="/creator/campaigns/preview">See the brief →</Link>
          </article>
          <p className="creator-footnote">Production uses a signed one-time token tied to the creator&apos;s number.</p>
        </>
      ) : null}

      {message ? <p className="creator-error" role="alert">{message}</p> : null}

      <div className="creator-auth-join">
        <span>New to Storyloop?</span>
        <Link href="/creator/onboarding">Join with your profile →</Link>
      </div>
    </div>
  );
}
