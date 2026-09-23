import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { requireAdminContext } from "@/auth/admin-context";
import { brandRowToThemeConfig } from "@/design-system/brand-settings";
import {
  resolveDefaultTheme,
  resolveStoryloopTheme,
  toCssVariables,
} from "@/design-system/theme";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OperationsNav } from "@/components/admin/operations-nav";

import { signOut } from "./actions";

const platformItems = [
  { label: "Company" },
  { label: "Team & Roles" },
  { label: "Brand & Appearance", href: "/admin/settings/brand" },
  { label: "Integrations", href: "/admin/settings/integrations" },
  { label: "Configuration", href: "/admin/settings/configuration" },
  { label: "Templates", href: "/admin/settings/templates" },
  { label: "Audit / System Logs", href: "/admin/settings/audit" },
];

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const { data: brandSettings } = await supabase
    .from("company_brand_settings")
    .select("default_theme,dark_colors,light_colors,gradient,typography,radius,spacing")
    .eq("company_id", context.companyId)
    .maybeSingle();

  const config = brandSettings ? brandRowToThemeConfig(brandSettings) : undefined;
  const themeName = resolveDefaultTheme(config);
  const tokens = resolveStoryloopTheme(themeName, config);
  const cssVariables = toCssVariables(tokens) as CSSProperties;

  return (
    <div className="admin-shell" data-theme={themeName} style={cssVariables}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <Link href="/admin" className="admin-brand">
          Storyloop
        </Link>

        <section className="admin-section">
          <div className="sl-system-label page-eyebrow">Platform</div>
          <nav className="admin-nav" aria-label="Platform configuration">
            {platformItems.map((item) =>
              item.href ? (
                <Link className="admin-nav-item" key={item.label} href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span className="admin-nav-item" key={item.label} aria-disabled="true">
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </section>

      </aside>

      <div className="admin-main">
        <OperationsNav />
        <header className="admin-topbar">
          <span className="sl-system-label page-eyebrow">{context.role}</span>
          <span className="admin-user">{context.email}</span>
          <form action={signOut}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
