"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminDestination, adminDestinations } from './admin-navigation';
import styles from './admin-navigation.module.css';

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = adminDestination(pathname);
  const [expansion, setExpansion] = useState<{ path: string; section: string | null }>({ path: pathname, section: active });
  const expanded = expansion.path === pathname ? expansion.section : active;
  return (
    <aside className={`admin-sidebar ${styles.sidebar}`} data-open={open} data-tour="navigation" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      <div className="admin-sidebar-head">
        <Link href="/admin/home" className="admin-brand" onClick={() => setOpen(false)}>Storyloop</Link>
        <button type="button" className="admin-nav-toggle" aria-expanded={open} aria-controls="admin-primary-nav" onClick={() => setOpen(value => !value)}>{open ? 'Close menu' : 'Menu'}</button>
      </div>
      <div className="admin-sidebar-scroll" id="admin-primary-nav">
        <nav className={`admin-nav ${styles.primary}`} aria-label="Admin navigation">
          {adminDestinations.map((item, index) => <div key={item.href}>
            <button type="button" className={`admin-nav-item ${styles.sectionToggle}`} data-active={active === item.href} aria-expanded={expanded === item.href} aria-controls={`admin-section-${index}`} onClick={() => setExpansion({ path: pathname, section: expanded === item.href ? null : item.href })}>
              <span>{item.label}</span><span className={styles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div id={`admin-section-${index}`} hidden={expanded !== item.href}>
              {item.children.map(child => <Link key={child.href} href={child.href} className={styles.child} data-active={pathname === child.href} aria-current={pathname === child.href ? 'page' : undefined} onClick={() => setOpen(false)}>{child.label}</Link>)}
            </div>
          </div>)}
        </nav>
      </div>
    </aside>
  );
}
