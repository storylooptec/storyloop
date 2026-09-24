import { CreatorMoneyDemo } from "@/components/creator/creator-money-demo";
import { getCreatorCmsContent } from "@/creator/cms";
import { requireCreatorContext } from "@/creator/context";

export default async function CreatorMoneyPage() {
  const [context, cms] = await Promise.all([requireCreatorContext(), getCreatorCmsContent()]);
  if (context.demoMode) return <CreatorMoneyDemo cms={cms} />;

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">MONEY</p>
        <h1>A calendar, not a ledger.</h1>
      </header>
      <section className="creator-empty-feed">
        <h2>{cms.money_empty_title ?? "Nothing due right now."}</h2>
        <p>{cms.money_empty_body ?? "Everything from this year is paid and filed."}</p>
      </section>
    </div>
  );
}
