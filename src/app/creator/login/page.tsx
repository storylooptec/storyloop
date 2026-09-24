import { redirect } from "next/navigation";

import { CreatorLoginForm } from "@/components/creator/creator-login-form";
import { getCreatorAuthMode } from "@/creator/auth-mode";
import { getCreatorContext } from "@/creator/context";

export default async function CreatorLoginPage() {
  const context = await getCreatorContext();
  if (context?.account?.onboarding_completed) redirect("/creator");

  return (
    <main className="creator-entry">
      <div className="creator-entry-brand">Storyloop</div>
      <CreatorLoginForm demoMode={getCreatorAuthMode() === "demo"} />
    </main>
  );
}
