import { CreatorHomeDemo } from "@/components/creator/creator-home-demo";
import { getCreatorCmsContent } from "@/creator/cms";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorHomePage() {
  const [context, cms] = await Promise.all([requireCreatorContext(), getCreatorCmsContent()]);
  if (context.demoMode) return <CreatorHomeDemo cms={cms} />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">HOME</p>
        <h1>What needs you now</h1>
      </header>
      <section className="creator-empty-feed">
        <h2>{cms.home_empty_title ?? "Nothing needs you today."}</h2>
        <p>{cms.home_empty_body ?? "New briefs, draft deadlines, revisions, sign-offs, payments and AI-demo requests will land here."}</p>
      </section>
    </div>
  );
}
