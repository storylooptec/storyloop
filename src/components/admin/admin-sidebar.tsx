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
  return (
    <aside className={`admin-sidebar ${styles.sidebar}`} data-open={open} data-tour="navigation" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      <div className="admin-sidebar-head">
        <Link href="/admin/home" className="admin-brand" onClick={() => setOpen(false)}>Storyloop</Link>
        <button type="button" className="admin-nav-toggle" aria-expanded={open} aria-controls="admin-primary-nav" onClick={() => setOpen(value => !value)}>{open ? 'Close menu' : 'Menu'}</button>
      </div>
      <div className="admin-sidebar-scroll" id="admin-primary-nav">
        <nav className={`admin-nav ${styles.primary}`} aria-label="Admin navigation">
          {adminDestinations.map(item => <div key={item.href}>
            <Link className="admin-nav-item" data-active={active === item.href} aria-current={active === item.href ? 'page' : undefined} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
            {item.href === '/admin/creators' && <Link href="/admin/discover" className={styles.child} data-active={pathname === '/admin/discover'} onClick={() => setOpen(false)}>Discover</Link>}
          </div>)}
        </nav>
      </div>
    </aside>
  );
}
