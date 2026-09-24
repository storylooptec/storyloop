import { redirect } from "next/navigation";

import { CreatorLoginForm } from "@/components/creator/creator-login-form";
import { getCreatorContext } from "@/creator/context";

export default async function CreatorLoginPage() {
  const context = await getCreatorContext();
  if (context?.account?.onboarding_completed) redirect("/creator");

  return (
    <main className="creator-entry">
      <div className="creator-entry-brand">Storyloop</div>
      <CreatorLoginForm />
    </main>
  );
}
