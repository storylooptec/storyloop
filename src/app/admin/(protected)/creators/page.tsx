import Link from "next/link";

import { requireAdminContext } from "@/auth/admin-context";
import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ q?: string; tab?: string }>;
};

const illustrativePool = [
  {
    name: "Illustrative Candidate A",
    handle: "@candidatea",
    followers: "84,200",
    views: "22,400",
    er: "2.3%",
    score: "91",
    updated: "2d",
  },
  {
    name: "Illustrative Candidate B",
    handle: "@candidateb",
    followers: "56,100",
    views: "18,900",
    er: "4.7%",
    score: "86",
    updated: "5d",
  },
];

export default async function CreatorsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const tab = params.tab === "pool" ? "pool" : "roster";

  const { data: relationships } =
    tab === "roster"
      ? await supabase
          .from("company_creators")
          .select("id,status,source,creator_id,creators(id,display_name,primary_handle,updated_at)")
          .eq("company_id", context.companyId)
          .order("updated_at", { ascending: false })
      : { data: null };

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
        {tab === "pool" ? <IllustrativeNote /> : null}
      </header>

      {params.q ? (
        <div className="parsed-chips">
          <span className="sl-system-label">Parsed search</span>
          <span className="query-chip">{params.q} ×</span>
        </div>
      ) : null}

      <div className="ops-tabs">
        <span className="tab-with-help">
          <Link href="/admin/creators" data-active={tab === "roster"}>Roster</Link>
          <ContextHelp text={adminHelp.roster} label="About the Roster" />
        </span>
        <span className="tab-with-help">
          <Link href="/admin/creators?tab=pool" data-active={tab === "pool"}>Pool</Link>
          <ContextHelp text={adminHelp.pool} label="About the Pool" />
        </span>
      </div>

      {tab === "pool" ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th className="numeric">Followers</th>
                <th className="numeric">Avg views</th>
                <th className="numeric">
                  <span className="field-label-with-help">
                    ER <ContextHelp text={adminHelp.engagementRate} label="About engagement rate" />
                  </span>
                </th>
                <th className="numeric">Score</th>
                <th className="numeric">Updated</th>
              </tr>
            </thead>
            <tbody>
              {illustrativePool.map((candidate) => (
                <tr key={candidate.handle}>
                  <td>{candidate.name}<small className="table-subline">{candidate.handle}</small></td>
                  <td>Discovery</td>
                  <td className="numeric">{candidate.followers}</td>
                  <td className="numeric">{candidate.views}</td>
                  <td className="numeric">{candidate.er}</td>
                  <td className="numeric">{candidate.score}</td>
                  <td className="numeric">{candidate.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="provenance">Pool is illustrative until candidate operational storage is added · candidates have no price</p>
        </div>
      ) : relationships && relationships.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th className="numeric">Followers</th>
                <th className="numeric">Avg views</th>
                <th className="numeric">
                  <span className="field-label-with-help">
                    ER <ContextHelp text={adminHelp.engagementRate} label="About engagement rate" />
                  </span>
                </th>
                <th className="numeric">Price (reel)</th>
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
                    <td>TBD</td>
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
          <strong>No roster creators yet</strong>
          <p>
            Creator operational analytics, provenance, freshness and KYC drawer appear
            once roster data is populated.
          </p>
        </section>
      )}
    </div>
  );
}
