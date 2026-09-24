import type { ReactNode } from "react";

import { CreatorShell } from "@/components/creator/creator-shell";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorHubLayout({ children }: { children: ReactNode }) {
  const context = await requireCreatorContext();
  const name = context.creator?.display_name ?? context.creator?.primary_handle ?? "Creator";

  return <CreatorShell tier={context.account.tier} name={name}>{children}</CreatorShell>;
}
