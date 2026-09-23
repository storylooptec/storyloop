import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { requireAdminContext } from "@/auth/admin-context";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminOnboarding } from "@/components/admin/admin-onboarding";
import { ContextHelp } from "@/components/admin/context-help";
import { brandRowToThemeConfig } from "@/design-system/brand-settings";
import { resolveDefaultTheme, resolveStoryloopTheme, toCssVariables } from "@/design-system/theme";
import { adminHelp } from "@/help/admin-help";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "@/app/admin/(protected)/actions";

export async function AdminShell({ children }: { children: ReactNode }) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();

  const [{ data: brandSettings }, { data: preference }] = await Promise.all([
    supabase
      .from("company_brand_settings")
      .select("default_theme,dark_colors,light_colors,gradient,typography,radius,spacing")
      .eq("company_id", context.companyId)
      .maybeSingle(),
    supabase
      .from("admin_user_preferences")
      .select("admin_onboarding_completed")
      .eq("company_id", context.companyId)
      .eq("user_id", context.userId)
      .maybeSingle(),
  ]);

  const config = brandSettings ? brandRowToThemeConfig(brandSettings) : undefined;
  const themeName = resolveDefaultTheme(config);
  const tokens = resolveStoryloopTheme(themeName, config);
  const cssVariables = toCssVariables(tokens) as CSSProperties;

  return (
    <div className="admin-shell" data-theme={themeName} style={cssVariables}>
      <AdminSidebar />

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-primary">
            <Link href="/admin/add" className="primary-button admin-add" data-tour="add">+ Add</Link>
            <label className="admin-global-search" data-tour="search">
              <span className="sr-only">Global search</span>
              <input disabled placeholder="Global search — not connected yet" aria-describedby="global-search-status" />
              <span id="global-search-status" className="admin-search-status">Reserved</span>
            </label>
          </div>

          <div className="admin-topbar-account">
            <Link href="/admin/overview?welcome=1" className="admin-help-link">Help</Link>
            <span className="admin-role-context" data-tour="help">
              <span className="sl-system-label">{context.role}</span>
              <ContextHelp
                text={context.role === "senior" ? adminHelp.senior : adminHelp.junior}
                label={`About the ${context.role} role`}
              />
            </span>
            <span className="admin-user">{context.email}</span>
            <form action={signOut}>
              <button className="secondary-button" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>

      <AdminOnboarding
        initiallyOpen={!preference?.admin_onboarding_completed}
        role={context.role}
      />
    </div>
  );
}
