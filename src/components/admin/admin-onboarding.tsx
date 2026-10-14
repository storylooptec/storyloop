"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { TeamRole } from "@/auth/permissions";
import { completeAdminOnboarding } from "@/actions/admin-preferences";

const tourStops = [
  { selector: '[data-tour="navigation"]', title: "Five main sections", text: "Home, Creators, Brands & enquiries, Campaigns and Settings keep daily work separate from system controls." },
  { selector: '[data-tour="navigation"]', title: "Discover", text: "Open Discover under Creators to search records, view details and preview or import spreadsheets." },
  { selector: '[data-tour="help"]', title: "Your access", text: "Your team role controls which settings and actions you can change. Existing permissions still apply." },
];

export function AdminOnboarding({
  initiallyOpen,
  role,
}: {
  initiallyOpen: boolean;
  role: TeamRole;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(() => initiallyOpen || searchParams.get("welcome") === "1");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [dontShow, setDontShow] = useState(true);
  const [pending, startTransition] = useTransition();
  const highlighted = useRef<Element | null>(null);

  useEffect(() => {
    highlighted.current?.classList.remove("tour-highlight");
    highlighted.current = null;

    if (tourStep === null) return;

    const stop = tourStops[tourStep];
    const target = document.querySelector(stop.selector);
    if (target) {
      target.classList.add("tour-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      highlighted.current = target;
    }

    return () => {
      target?.classList.remove("tour-highlight");
    };
  }, [tourStep]);

  function finish() {
    if (searchParams.get("welcome") === "1") router.replace("/admin/home");
    setOpen(false);
    setTourStep(null);

    if (dontShow) {
      startTransition(async () => {
        await completeAdminOnboarding();
      });
    }
  }

  if (!open && searchParams.get("welcome") !== "1" && tourStep === null) return null;

  if (tourStep !== null) {
    const stop = tourStops[tourStep];
    return (
      <div className="admin-tour-card" role="dialog" aria-modal="false" aria-labelledby="admin-tour-title">
        <p className="sl-system-label page-eyebrow">Admin tour · {tourStep + 1} / {tourStops.length}</p>
        <h2 id="admin-tour-title">{stop.title}</h2>
        <p>{stop.text}</p>
        <div className="admin-tour-actions">
          <button type="button" className="secondary-button" onClick={finish}>Skip</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (tourStep === tourStops.length - 1) finish();
              else setTourStep(tourStep + 1);
            }}
          >
            {tourStep === tourStops.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-onboarding-backdrop" role="presentation">
      <section className="admin-onboarding" role="dialog" aria-modal="true" aria-labelledby="admin-welcome-title">
        <p className="sl-system-label page-eyebrow">Storyloop internal workspace</p>
        <h1 id="admin-welcome-title">Welcome to Storyloop Admin</h1>
        <p className="admin-onboarding-intro">
          Start with Home for pending work, or open Discover under Creators for your creator database.
        </p>

        <div className="admin-capability-grid">
          {[
            ["Home", "See creator counts and incomplete onboarding."],
            ["Creators / Discover", "Search records, inspect details and import spreadsheets."],
            ["Brands & enquiries", "Admin records are not connected yet; the page shows this clearly."],
            ["Campaigns", "Open campaign measurement tools. The admin board is not connected yet."],
            ["Settings", "Find team, content, appearance, integration, usage and activity controls."],
          ].map(([title, copy]) => (
            <article className="admin-capability" key={title}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>

        <div className="admin-role-explainer">
          <span className="sl-system-label">{role}</span>
          <p>
            {role === "senior"
              ? "You have Senior access to available operational tools and administrative settings. Unconnected tools remain unavailable."
              : "You have Junior access to available operational tools. Administrative settings are read-only where Senior permission is required."}
          </p>
        </div>

        <label className="admin-onboarding-checkbox">
          <input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} />
          Don&apos;t show this automatically again
        </label>

        <div className="admin-onboarding-actions">
          <button type="button" className="secondary-button" onClick={() => setTourStep(0)}>
            Show me around
          </button>
          <button type="button" className="primary-button" disabled={pending} onClick={finish}>
            {pending ? "Saving…" : "Start using Admin"}
          </button>
        </div>
      </section>
    </div>
  );
}
