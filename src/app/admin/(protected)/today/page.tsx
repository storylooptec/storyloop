import Link from "next/link";

import { requireAdminContext } from "@/auth/admin-context";
import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const [incompleteResult, revokedResult] = await Promise.all([
    supabase
      .from("creator_accounts")
      .select("creator_id,onboarding_step,updated_at,creators(display_name,primary_handle)")
      .eq("company_id", context.companyId)
      .eq("onboarding_completed", false)
      .order("updated_at", { ascending: true })
      .limit(8),
    supabase
      .from("creator_studio_profiles")
      .select("creator_id,setup_status,updated_at,creators(display_name,primary_handle)")
      .eq("setup_status", "revoked")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const alerts = [
    ...(incompleteResult.data ?? []).map((row) => {
      const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
      return {
        creatorId: row.creator_id,
        title: creator?.display_name ?? creator?.primary_handle ?? "Creator onboarding",
        detail: "Onboarding paused at step " + row.onboarding_step + "/9",
        meta: "Creator",
      };
    }),
    ...(revokedResult.data ?? []).map((row) => {
      const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
      return {
        creatorId: row.creator_id,
        title: creator?.display_name ?? creator?.primary_handle ?? "Creator likeness",
        detail: "Studio likeness revoked — generation must remain blocked",
        meta: "Consent",
      };
    }),
  ];

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Today · needs you first</p>
          <h1 className="page-title">Today</h1>
          <p className="page-copy">
            Live Creator operational alerts first; illustrative agency work remains clearly separated.
          </p>
        </div>
      </header>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">
          Creator operations · {alerts.length}
        </div>

        {alerts.length ? (
          <div className="queue-list">
            {alerts.map((alert) => (
              <div className="queue-row" key={alert.creatorId + alert.detail}>
                <span className="queue-dot" aria-hidden="true" />
                <div className="queue-copy">
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
                <span className="queue-meta">{alert.meta}</span>
                <Link href={"/admin/creators/" + alert.creatorId} className="secondary-button admin-inline-link">
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="overview-muted">No Creator operational alerts right now.</p>
        )}
      </section>

      <div className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Agency queue · illustrative</p>
        </div>
        <IllustrativeNote />
      </div>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">Existing agency queue</div>
        <p className="overview-muted">
          Brand, campaign and money queues stay illustrative until their live engines exist.
        </p>
      </section>
    </div>
  );
}
