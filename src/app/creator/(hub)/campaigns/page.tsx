import { CreatorCampaignsDemo } from "@/components/creator/creator-campaigns-demo";
import { getCreatorCmsContent } from "@/creator/cms";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorCampaignsPage() {
  const [context, cms] = await Promise.all([requireCreatorContext(), getCreatorCmsContent()]);
  if (context.demoMode) return <CreatorCampaignsDemo cms={cms} />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CAMPAIGNS</p>
        <h1>One list, three groups.</h1>
      </header>
      <section className="creator-empty-feed">
        <h2>{cms.campaigns_empty_title ?? "No briefs yet."}</h2>
        <p>{cms.campaigns_empty_body ?? "Your live campaign feed will appear here."}</p>
      </section>
    </div>
  );
}
