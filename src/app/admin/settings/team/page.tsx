import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TeamSettingsPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const { data: members, error } = await supabase
    .from("team_memberships")
    .select("id,user_id,role,status,created_at")
    .eq("company_id", context.companyId)
    .order("created_at");

  if (error) throw new Error("Unable to load team memberships");

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Platform / Access</p>
          <h1 className="page-title">Team & Roles</h1>
          <p className="page-copy">
            Storyloop team membership and the Junior/Senior permission model. Junior drafts; Senior sends.
          </p>
        </div>
      </header>

      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {(members ?? []).map((member) => (
              <tr key={member.id}>
                <td>
                  {member.user_id === context.userId ? (context.email ?? "Current user") : "Storyloop team member"}
                  <small className="table-subline">{member.user_id}</small>
                </td>
                <td>{member.role}</td>
                <td>{member.status}</td>
                <td>{new Date(member.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="role-foundation">
        <article><span className="sl-system-label">Junior</span><p>Draft, review, enrich, prepare and perform reversible operational actions within configured limits.</p></article>
        <article><span className="sl-system-label">Senior</span><p>Junior capabilities plus approvals, sending, configuration, controlled permissions and financial actions.</p></article>
      </section>
    </div>
  );
}
