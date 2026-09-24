import { CreatorCampaignFlowDemo } from "@/components/creator/creator-campaign-flow-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CampaignPreviewPage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorCampaignFlowDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CAMPAIGN</p>
        <h1>No campaign selected.</h1>
      </header>
    </div>
  );
}
