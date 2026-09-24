import type { ReactNode } from "react";

import { CreatorNav } from "@/components/creator/creator-nav";
import type { CreatorTier } from "@/creator/context";

export function CreatorShell({
  children,
  tier,
  name,
}: {
  children: ReactNode;
  tier: CreatorTier;
  name: string;
}) {
  return (
    <div className="creator-app-shell">
      <header className="creator-topbar">
        <span className="creator-topbar-brand">Storyloop</span>
        <span className="creator-topbar-context">{name} · {tier}</span>
      </header>
      <main className="creator-main">{children}</main>
      <CreatorNav />
    </div>
  );
}
