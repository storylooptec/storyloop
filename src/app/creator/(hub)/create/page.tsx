import { CreatorCreateDemo } from "@/components/creator/creator-create-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorCreatePage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorCreateDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">CREATE · {context.account.tier.toUpperCase()}</p>
        <h1>Useful things, using your data.</h1>
      </header>
      <p className="creator-muted">Creator tools appear here as providers are connected.</p>
    </div>
  );
}
