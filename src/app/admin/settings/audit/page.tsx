import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";

export default async function AuditLogPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id,action,entity_type,entity_id,status,is_reversible,duration_minutes,created_at,actor_user_id")
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load audit logs");

  return (
    <>
      <p className="sl-system-label page-eyebrow">Platform / Audit</p>
      <h1 className="page-title">Audit / System Logs</h1>
      <p className="page-copy">
        Append-only record of sensitive actions, configuration changes, integration state,
        failed jobs, and operational time where recorded.
      </p>

      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Status</th>
              <th>
                <span className="field-label-with-help">
                  Reversible
                  <ContextHelp text={adminHelp.auditUndo} label="About reversible audit events" />
                </span>
              </th>
              <th>Minutes</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.action}</td>
                <td>
                  {log.entity_type ?? "—"}
                  {log.entity_id ? <small>{log.entity_id}</small> : null}
                </td>
                <td>{log.status}</td>
                <td>{log.is_reversible ? "Yes" : "No"}</td>
                <td>{log.duration_minutes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
