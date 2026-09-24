import { CreatorMoneyDemo } from "@/components/creator/creator-money-demo";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorMoneyPage() {
  const context = await requireCreatorContext();

  if (context.demoMode) return <CreatorMoneyDemo />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">MONEY</p>
        <h1>A calendar, not a ledger.</h1>
      </header>
      <section className="creator-empty-feed"><h2>Nothing due right now.</h2></section>
    </div>
  );
}
