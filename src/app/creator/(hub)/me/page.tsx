import { CreatorMeDemo } from "@/components/creator/creator-me-demo";
import { getCreatorCmsContent } from "@/creator/cms";
import { requireCreatorContext } from "@/creator/context";

import { creatorSignOut } from "./actions";

export default async function CreatorMePage() {
  const [context, cms] = await Promise.all([requireCreatorContext(), getCreatorCmsContent()]);

  if (context.demoMode) {
    return (
      <>
        <CreatorMeDemo cms={cms} />
        <form action={creatorSignOut} className="creator-demo-signout">
          <button className="creator-text-button" type="submit">End demo session</button>
        </form>
      </>
    );
  }

  return (
    <div className="creator-screen">
      <header className="creator-screen-head">
        <p className="creator-kicker">ME · {context.account.tier.toUpperCase()}</p>
        <h1>{context.creator?.display_name ?? context.creator?.primary_handle ?? "Your Storyloop record"}</h1>
      </header>
      <form action={creatorSignOut}>
        <button className="creator-secondary" type="submit">Sign out</button>
      </form>
    </div>
  );
}
