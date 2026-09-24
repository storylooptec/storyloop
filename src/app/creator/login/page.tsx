import { redirect } from "next/navigation";

import { CreatorBrandLogo } from "@/components/creator/creator-brand-logo";
import { CreatorLoginForm } from "@/components/creator/creator-login-form";
import { getCreatorAuthMode } from "@/creator/auth-mode";
import { getCreatorBrandLogoUrl } from "@/creator/brand";
import { getCreatorContext } from "@/creator/context";

export default async function CreatorLoginPage() {
  const [context, logoUrl] = await Promise.all([
    getCreatorContext(),
    getCreatorBrandLogoUrl(),
  ]);
  if (context?.account?.onboarding_completed) redirect("/creator");

  return (
    <main className="creator-entry">
      <CreatorBrandLogo src={logoUrl} />
      <CreatorLoginForm demoMode={getCreatorAuthMode() === "demo"} />
    </main>
  );
}
