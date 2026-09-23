"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type TooltipProps = {
  content: string;
  children: ReactNode;
  label?: string;
};

export function Tooltip({ content, children, label }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="tooltip"
      data-open={open ? "true" : "false"}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="tooltip-trigger"
        tabIndex={0}
        aria-describedby={id}
        aria-label={label}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </span>
      <span id={id} role="tooltip" className="context-help-popover">
        {content}
      </span>
    </span>
  );
}
