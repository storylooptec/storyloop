"use client";

import { useId, useState } from "react";

type ContextHelpProps = {
  text: string;
  label?: string;
  triggerLabel?: "i" | "?";
  className?: string;
};

export function ContextHelp({
  text,
  label = "More information",
  triggerLabel = "i",
  className = "",
}: ContextHelpProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`context-help ${className}`}
      data-open={open ? "true" : "false"}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="context-help-trigger"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        {triggerLabel}
      </button>
      <span id={id} role="tooltip" className="context-help-popover">
        {text}
      </span>
    </span>
  );
}
