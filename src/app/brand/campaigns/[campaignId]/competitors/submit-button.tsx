"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ResearchButton({ children, pendingLabel = "Saving…", className, disabled = false }: { children: ReactNode; pendingLabel?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending}>
    <span role={pending ? "status" : undefined}>{pending ? pendingLabel : children}</span>
  </button>;
}
