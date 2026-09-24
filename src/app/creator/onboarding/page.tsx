import { CreatorBrandLogo } from "@/components/creator/creator-brand-logo";
import { CreatorOnboardingFlow } from "@/components/creator/creator-onboarding-flow";
import { getCreatorAuthMode } from "@/creator/auth-mode";
import { getCreatorBrandLogoUrl } from "@/creator/brand";
import { configByKey, getCreatorConfiguration } from "@/creator/config";
import { getCreatorContext } from "@/creator/context";

export default async function CreatorOnboardingPage() {
  const [context, config, logoUrl] = await Promise.all([
    getCreatorContext(),
    getCreatorConfiguration(),
    getCreatorBrandLogoUrl(),
  ]);
  const ageConfig = configByKey(config, "creator_age_verification_method");

  return (
    <main className="creator-entry creator-onboarding-entry">
      <CreatorBrandLogo src={logoUrl} />
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
