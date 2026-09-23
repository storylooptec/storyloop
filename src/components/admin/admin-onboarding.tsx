"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { TeamRole } from "@/auth/permissions";
import { completeAdminOnboarding } from "@/actions/admin-preferences";

const tourStops = [
  { selector: '[data-tour="navigation"]', title: "Navigation", text: "Operations is daily agency work. Platform controls Storyloop itself." },
  { selector: '[data-tour="add"]', title: "+ Add", text: "Use Add as the controlled intake point for new operational records." },
  { selector: '[data-tour="search"]', title: "Global search", text: "The control is reserved now; live global search is not connected yet." },
  { selector: '[data-tour="today"]', title: "Today", text: "Today is the ordered work queue, not an analytics dashboard." },
  { selector: '[data-tour="help"]', title: "Context help", text: "Use the question-mark help system for unfamiliar Storyloop terminology." },
];

export function AdminOnboarding({
  initiallyOpen,
  role,
}: {
  initiallyOpen: boolean;
  role: TeamRole;
}) {
  const [open, setOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [dontShow, setDontShow] = useState(true);
  const [pending, startTransition] = useTransition();
  const highlighted = useRef<Element | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("welcome") === "1";
    const hiddenForSession = window.sessionStorage.getItem("storyloop-admin-welcome-hidden") === "1";
    setOpen(forced || (initiallyOpen && !hiddenForSession));
  }, [initiallyOpen]);

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
    window.sessionStorage.setItem("storyloop-admin-welcome-hidden", "1");
    setOpen(false);
    setTourStep(null);

    if (dontShow) {
      startTransition(async () => {
        await completeAdminOnboarding();
      });
    }
  }

  if (!open && tourStep === null) return null;

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
          Your control room for creators, brands, campaigns, discovery, money and platform settings.
        </p>

        <div className="admin-capability-grid">
          {[
            ["Today", "See what needs attention first."],
            ["Creators", "Manage the consented roster and candidate pool."],
            ["Discover", "Find, review and prepare outreach to new creators."],
            ["Brands", "Manage brand rooms, intelligence and enquiries."],
            ["Campaigns", "Move campaigns through the controlled workflow."],
            ["Money", "Monitor payouts, invoices, exposure and financial status."],
            ["Platform", "Manage company settings, team access, permissions and product controls."],
            ["Integrations & Templates", "Configure external systems and reusable communication templates."],
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
              ? "You can draft, review and enrich, and additionally approve, send, configure, grant controlled permissions and perform financial actions."
              : "You can draft, review, enrich, prepare and perform reversible operational actions. Senior approval is required for sending, configuration and financial actions."}
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
