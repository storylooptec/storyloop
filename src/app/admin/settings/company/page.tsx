import { requireAdminContext } from "@/auth/admin-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CompanySettingsPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("name,slug,status,created_at,updated_at")
    .eq("id", context.companyId)
    .single();

  if (error || !company) throw new Error("Unable to load company");

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Platform / Company</p>
          <h1 className="page-title">Company</h1>
          <p className="page-copy">The company record that scopes Storyloop team access and company-owned configuration.</p>
        </div>
      </header>

      <section className="detail-panel">
        <dl className="detail-list">
          <div><dt>Name</dt><dd>{company.name}</dd></div>
          <div><dt>Slug</dt><dd><code>{company.slug}</code></dd></div>
          <div><dt>Status</dt><dd>{company.status}</dd></div>
          <div><dt>Created</dt><dd>{new Date(company.created_at).toLocaleString()}</dd></div>
          <div><dt>Last updated</dt><dd>{new Date(company.updated_at).toLocaleString()}</dd></div>
        </dl>
      </section>

      <p className="settings-notice">
        Company identity editing is not introduced in this repair slice. Existing company isolation is preserved.
      </p>
    </div>
  );
}
