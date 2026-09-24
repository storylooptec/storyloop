"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sections = [
  {
    label: "Storyloop",
    items: [{ label: "Overview", href: "/admin/overview" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Today", href: "/admin/today" },
      { label: "Creators", href: "/admin/creators" },
      { label: "Discover", href: "/admin/discover" },
      { label: "Brands", href: "/admin/brands" },
      { label: "Campaigns", href: "/admin/campaigns" },
      { label: "Money", href: "/admin/money" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Company", href: "/admin/settings/company" },
      { label: "Team & Roles", href: "/admin/settings/team" },
      { label: "Experiences", href: "/admin/settings/experiences" },
      { label: "Creator Experience", href: "/admin/settings/creator-experience" },
      { label: "Brand & Appearance", href: "/admin/settings/brand" },
      { label: "Integrations", href: "/admin/settings/integrations" },
      { label: "Configuration", href: "/admin/settings/configuration" },
      { label: "Templates", href: "/admin/settings/templates" },
      { label: "Audit & Logs", href: "/admin/settings/audit" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="admin-sidebar" data-open={open} data-tour="navigation">
      <div className="admin-sidebar-head">
        <Link href="/admin/overview" className="admin-brand" onClick={() => setOpen(false)}>
          Storyloop
        </Link>
        <button
          type="button"
          className="admin-nav-toggle"
          aria-expanded={open}
          aria-controls="admin-primary-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div className="admin-sidebar-scroll" id="admin-primary-nav">
        {sections.map((section) => (
          <section className="admin-section" key={section.label}>
            <div className="sl-system-label admin-section-label">{section.label}</div>
            <nav className="admin-nav" aria-label={section.label}>
              {section.items.map((item) => (
                <Link
                  className="admin-nav-item"
                  data-active={isActive(pathname, item.href)}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  key={item.href}
                  href={item.href}
                  data-tour={item.href === "/admin/today" ? "today" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>
        ))}
      </div>
    </aside>
  );
}
