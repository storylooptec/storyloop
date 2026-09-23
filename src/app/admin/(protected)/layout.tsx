import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { signOut } from "./actions";

const platformItems = [
  "Company",
  "Team & Roles",
  "Brand & Appearance",
  "Integrations",
  "Configuration",
  "Templates",
  "Audit / System Logs",
];

const operationsItems = [
  "Today",
  "Creators",
  "Discover",
  "Brands",
  "Campaigns",
  "Money",
];

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <Link href="/admin" className="admin-brand">
          Storyloop
        </Link>

        <section className="admin-section">
          <div className="sl-system-label page-eyebrow">Platform</div>
          <nav className="admin-nav" aria-label="Platform configuration">
            {platformItems.map((item) => (
              <span className="admin-nav-item" key={item} aria-disabled="true">
                {item}
              </span>
            ))}
          </nav>
        </section>

        <section className="admin-section">
          <div className="sl-system-label page-eyebrow">Operations</div>
          <nav className="admin-nav" aria-label="Storyloop operations">
            {operationsItems.map((item) => (
              <span className="admin-nav-item" key={item} aria-disabled="true">
                {item}
              </span>
            ))}
          </nav>
        </section>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <span className="admin-user">{user.email}</span>
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
