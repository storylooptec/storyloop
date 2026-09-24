import { CreatorOnboardingFlow } from "@/components/creator/creator-onboarding-flow";
import { getCreatorAuthMode } from "@/creator/auth-mode";
import { configByKey, getCreatorConfiguration } from "@/creator/config";
import { getCreatorContext } from "@/creator/context";

export default async function CreatorOnboardingPage() {
  const [context, config] = await Promise.all([
    getCreatorContext(),
    getCreatorConfiguration(),
  ]);
  const ageConfig = configByKey(config, "creator_age_verification_method");

  return (
    <main className="creator-entry creator-onboarding-entry">
      <div className="creator-entry-brand">Storyloop</div>
      <CreatorOnboardingFlow
        initialStep={context?.account?.onboarding_step ?? 1}
        initialData={context?.account?.onboardingData ?? {}}
        authenticated={Boolean(context?.account)}
        ageMethodTbd={!ageConfig || ageConfig.is_tbd}
        demoMode={getCreatorAuthMode() === "demo"}
      />
    </main>
  );
}
