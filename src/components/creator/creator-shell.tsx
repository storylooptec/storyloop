import type { ReactNode } from "react";

import { CreatorBrandLogo } from "@/components/creator/creator-brand-logo";
import { CreatorNav } from "@/components/creator/creator-nav";
import type { CreatorTier } from "@/creator/context";

export function CreatorShell({
  children,
  tier,
  name,
  logoUrl,
}: {
  children: ReactNode;
  tier: CreatorTier;
  name: string;
  logoUrl: string | null;
}) {
  return (
    <div className="creator-app-shell">
      <header className="creator-topbar">
        <CreatorBrandLogo src={logoUrl} compact />
        <span className="creator-topbar-context">{name} · {tier}</span>
      </header>
      <main className="creator-main">{children}</main>
      <CreatorNav />
    </div>
  );
}
