import Link from "next/link";
import type { ReactNode } from "react";

import { signOutBrandAction } from "@/app/brand/actions";
import { BrandWordmark } from "./brand-wordmark";
import styles from "@/app/brand/brand.module.css";

const links = [
  { href: "/brand/home", label: "Home", icon: "⌂" },
  { href: "/brand/discover", label: "Discover", icon: "⌕" },
  { href: "/brand/competitors", label: "Competitors", icon: "◉" },
  { href: "/brand/plan", label: "Plan", icon: "▤" },
  { href: "/brand/create", label: "Create", icon: "✳" },
  { href: "/brand/reports", label: "Reports", icon: "▥" },
];

export function BrandShell({
  children,
  active,
  companyName,
  email,
}: {
  children: ReactNode;
  active: string;
  companyName: string;
  email: string | null;
}) {
  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <Link href="/brand/home" className={styles.brandLogo} aria-label="Storyloop brand workspace">
          <BrandWordmark />
        </Link>
        <div className={styles.workspaceBox}>
          <span className={styles.muted}>Brand workspace</span>
          <strong style={{ display: "block", marginTop: 5 }}>{companyName}</strong>
        </div>
        <nav className={styles.sideNav} aria-label="Brand workspace">
          {links.map((item) => (
            <Link key={item.href} href={item.href} data-active={active === item.label ? "true" : undefined} aria-current={active === item.label ? "page" : undefined}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <form action={signOutBrandAction}>
            <button className={styles.secondaryButton} type="submit" style={{ width: "100%" }}>Sign out</button>
          </form>
        </div>
      </aside>
      <div className={styles.mainArea}>
        <header className={styles.appTopbar}>
          <span className={styles.muted}>{companyName}</span>
          <span className={styles.muted}>{email ?? "Brand member"}</span>
        </header>
        <main className={styles.appContent}>{children}</main>
      </div>
    </div>
  );
}
