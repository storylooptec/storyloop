"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestCreatorOtp, verifyCreatorOtp } from "@/app/creator/login/actions";

export function CreatorLoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(20);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (stage !== "otp" || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [stage, resendIn]);

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

  return (
    <div className="creator-auth-card">
      <p className="creator-kicker">CREATOR SIGN IN</p>
      <h1>Phone. OTP. You&apos;re in.</h1>
      <p className="creator-muted">No password. Returning sessions stay signed in on this device.</p>

      {stage === "phone" ? (
        <div className="creator-field-stack">
          <label htmlFor="creator-phone">Phone number</label>
          <input
            id="creator-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91…"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <button className="creator-primary" type="button" disabled={pending} onClick={send}>
            {pending ? "Sending…" : "Send OTP"}
          </button>
        </div>
      ) : (
        <div className="creator-field-stack">
          <div className="creator-auth-context">
            <span>OTP sent to</span>
            <strong>{phone}</strong>
            <button type="button" onClick={() => setStage("phone")}>Change</button>
          </div>
          <label htmlFor="creator-otp">Six-digit OTP</label>
          <input
            id="creator-otp"
            className="creator-otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button className="creator-primary" type="button" disabled={pending || otp.length !== 6} onClick={verify}>
            {pending ? "Checking…" : "Continue"}
          </button>
          <button
            className="creator-text-button"
            type="button"
            disabled={pending || resendIn > 0}
            onClick={send}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
          </button>
        </div>
      )}

      {message ? <p className="creator-error" role="alert">{message}</p> : null}
      <p className="creator-footnote">Phone OTP requires the Storyloop Supabase SMS provider to be enabled.</p>
    </div>
  );
}
