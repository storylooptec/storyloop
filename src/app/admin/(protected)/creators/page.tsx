import Link from "next/link";

import { requireAdminContext } from "@/auth/admin-context";
import { ContextHelp } from "@/components/admin/context-help";
import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { adminHelp } from "@/help/admin-help";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ q?: string; tab?: string }> };

const illustrativePool = [
  { name: "Illustrative Candidate A", handle: "@candidatea", followers: "84,200", views: "22,400", er: "2.3%", score: "91", updated: "2d" },
  { name: "Illustrative Candidate B", handle: "@candidateb", followers: "56,100", views: "18,900", er: "4.7%", score: "86", updated: "5d" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function CreatorsPage({ searchParams }: Props) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const tab = params.tab === "pool" ? "pool" : "roster";

  const { data: relationships } =
    tab === "roster"
      ? await supabase
          .from("company_creators")
          .select("id,status,source,creator_id,updated_at,creators(id,display_name,primary_handle,updated_at,metadata)")
          .eq("company_id", context.companyId)
          .order("updated_at", { ascending: false })
      : { data: null };

  const creatorIds = (relationships ?? []).map((row) => row.creator_id);

  const [accountsResult, socialsResult, studiosResult] = creatorIds.length
    ? await Promise.all([
        supabase
          .from("creator_accounts")
          .select("creator_id,tier,onboarding_step,onboarding_completed,onboarding_data,updated_at")
          .eq("company_id", context.companyId)
          .in("creator_id", creatorIds),
        supabase
          .from("creator_social_accounts")
          .select("creator_id,handle,platform,verification_status,metadata,updated_at")
          .in("creator_id", creatorIds),
        supabase
          .from("creator_studio_profiles")
          .select("creator_id,setup_status,consent_scope,updated_at")
          .in("creator_id", creatorIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const accountMap = new Map((accountsResult.data ?? []).map((row) => [row.creator_id, row]));
  const socialMap = new Map((socialsResult.data ?? []).map((row) => [row.creator_id, row]));
  const studioMap = new Map((studiosResult.data ?? []).map((row) => [row.creator_id, row]));

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Supply</p>
          <h1 className="page-title">Creators</h1>
          <p className="page-copy">
            Live Creator Hub data flows into Roster. Pool stays separate until discovery persistence is added.
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
                <th>Name</th><th>Source</th><th className="numeric">Followers</th>
                <th className="numeric">Avg views</th><th className="numeric">ER</th>
                <th className="numeric">Score</th><th className="numeric">Updated</th>
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
          <p className="provenance">Pool remains illustrative · candidates have no price</p>
        </div>
      ) : relationships && relationships.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Name</th><th>Tier</th><th>Onboarding</th><th>Profile</th>
                <th className="numeric">Price (reel)</th><th>Studio</th><th className="numeric">Updated</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((relationship) => {
                const creator = Array.isArray(relationship.creators) ? relationship.creators[0] : relationship.creators;
                const account = accountMap.get(relationship.creator_id);
                const social = socialMap.get(relationship.creator_id);
                const studio = studioMap.get(relationship.creator_id);
                const onboarding = asRecord(account?.onboarding_data);
                const rates = asRecord(onboarding.askedRates);
                const reelRate = typeof rates.reel === "number" ? rates.reel : null;

                return (
                  <tr key={relationship.id}>
                    <td>
                      <Link href={"/admin/creators/" + relationship.creator_id} className="admin-table-link">
                        {creator?.display_name ?? creator?.primary_handle ?? "Unnamed creator"}
                      </Link>
                      {creator?.primary_handle ? <small className="table-subline">@{creator.primary_handle}</small> : null}
                    </td>
                    <td>{account?.tier ?? "—"}</td>
                    <td>{account?.onboarding_completed ? "Complete" : "Step " + (account?.onboarding_step ?? "—") + "/9"}</td>
                    <td>{social?.verification_status ?? "No social"}</td>
                    <td className="numeric">{reelRate ? "₹" + reelRate.toLocaleString("en-IN") : "—"}</td>
                    <td>{studio?.setup_status ?? "Not set up"}</td>
                    <td className="numeric">{account?.updated_at ? new Date(account.updated_at).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="ops-empty">
          <strong>No roster creators yet</strong>
          <p>Real Creator Hub signups will appear here automatically after onboarding completes.</p>
        </section>
      )}
    </div>
  );
}
