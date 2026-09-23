"use client";

import { useEffect, useState } from "react";

type PreviewState = {
  canvas: string;
  surface: string;
  raised: string;
  line: string;
  ink: string;
  body: string;
  accent: string;
};

export function BrandLivePreview({
  formId,
  initial,
}: {
  formId: string;
  initial: PreviewState;
}) {
  const [tokens, setTokens] = useState(initial);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const update = () => {
      const data = new FormData(form);
      const theme = String(data.get("defaultTheme") ?? "dark");
      const prefix = theme === "light" ? "light" : "dark";
      const read = (key: string, fallback: string) => String(data.get(`${prefix}_${key}`) ?? fallback);

      setTokens({
        canvas: read("canvas", initial.canvas),
        surface: read("surface", initial.surface),
        raised: read("raised", initial.raised),
        line: read("line", initial.line),
        ink: read("ink", initial.ink),
        body: read("body", initial.body),
        accent: read("accent", initial.accent),
      });
    };

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [formId, initial]);

  return (
    <aside
      className="brand-live-preview"
      style={{
        background: tokens.canvas,
        color: tokens.body,
        borderColor: tokens.line,
      }}
    >
      <div className="brand-preview-head">
        <span style={{ color: tokens.accent }}>LIVE PREVIEW</span>
        <strong style={{ color: tokens.ink }}>Storyloop controls</strong>
      </div>
      <div className="brand-preview-card" style={{ background: tokens.surface, borderColor: tokens.line }}>
        <span>Representative Admin card</span>
        <strong style={{ color: tokens.ink }}>Campaign health</strong>
        <p>One compact surface showing hierarchy, labels and body copy.</p>
        <div className="brand-preview-actions">
          <button type="button" style={{ background: tokens.accent, color: "#fff" }}>Primary</button>
          <button type="button" style={{ background: "transparent", color: tokens.body, borderColor: tokens.line }}>Secondary</button>
        </div>
      </div>
      <div className="brand-preview-table" style={{ background: tokens.raised, borderColor: tokens.line }}>
        <span>Creator row</span><strong style={{ color: tokens.ink }}>₹24,000</strong>
      </div>
      <div className="brand-preview-tooltip" style={{ background: tokens.raised, borderColor: tokens.line }}>
        <strong style={{ color: tokens.ink }}>Context help</strong>
        <span>Short explanatory copy stays readable.</span>
      </div>
    </aside>
  );
}
