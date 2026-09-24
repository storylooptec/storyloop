import { CreatorCampaignsDemo } from "@/components/creator/creator-campaigns-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorCampaignsPage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorCampaignsDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CAMPAIGNS</p>
        <h1>One list, three groups.</h1>
      </header>
      <section className="creator-empty-feed">
        <h2>No briefs yet.</h2>
        <p>Your live campaign feed will appear here.</p>
      </section>
    </div>
  );
}
