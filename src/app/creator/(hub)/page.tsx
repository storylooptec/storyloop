import { CreatorHomeDemo } from "@/components/creator/creator-home-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorHomePage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorHomeDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">HOME</p>
        <h1>What needs you now</h1>
      </header>
      <section className="creator-empty-feed">
        <h2>Nothing needs you today.</h2>
        <p>New briefs, draft deadlines, revisions, sign-offs, payments and AI-demo requests will land here.</p>
      </section>
    </div>
  );
}
