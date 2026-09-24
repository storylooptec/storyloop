import { CreatorStudioDemo } from "@/components/creator/creator-studio-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorStudioPage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorStudioDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">STUDIO</p>
        <h1>{context.account.tier === "free" ? "Visible, but locked." : "Your likeness setup"}</h1>
      </header>
    </div>
  );
}
