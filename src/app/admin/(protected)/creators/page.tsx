import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ q?: string; tab?: string }>;
};

export default async function CreatorsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const tab = params.tab === "pool" ? "pool" : "roster";

  const { data: relationships } = await supabase
    .from("company_creators")
    .select("id,status,source,creator_id,creators(id,display_name,primary_handle,updated_at)")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Supply</p>
          <h1 className="page-title">Creators</h1>
          <p className="page-copy">
            Roster and Pool stay separate. Candidates never become brand-facing supply.
          </p>
        </div>
      </header>

      {params.q ? (
        <div className="parsed-chips">
          <span className="sl-system-label">Parsed search</span>
          <span className="query-chip">{params.q} ×</span>
        </div>
      ) : null}

      <div className="ops-tabs">
        <a href="/admin/creators" data-active={tab === "roster"}>Roster</a>
        <a href="/admin/creators?tab=pool" data-active={tab === "pool"}>Pool</a>
      </div>

      {relationships && relationships.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th className="numeric">Followers</th>
                <th className="numeric">Avg views</th>
                <th className="numeric">ER</th>
                <th className="numeric">{tab === "roster" ? "Price (reel)" : "Score"}</th>
                <th className="numeric">Updated</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((relationship) => {
                const creator = Array.isArray(relationship.creators)
                  ? relationship.creators[0]
                  : relationship.creators;
                return (
                  <tr key={relationship.id}>
                    <td>{creator?.display_name ?? creator?.primary_handle ?? "Unnamed creator"}</td>
                    <td>{tab === "roster" ? "TBD" : "Candidate"}</td>
                    <td className="numeric">—</td>
                    <td className="numeric">—</td>
                    <td className="numeric">—</td>
                    <td className="numeric">—</td>
                    <td className="numeric">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="ops-empty">
          <strong>{tab === "roster" ? "No roster creators yet" : "No candidates in Pool yet"}</strong>
          <p>
            Use + Add or Discover. Analytics, provenance, freshness and KYC drawer
            appear when creator operational data exists.
          </p>
        </section>
      )}
    </div>
  );
}
