"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Home", "/creator"],
  ["Campaigns", "/creator/campaigns"],
  ["Money", "/creator/money"],
  ["Create", "/creator/create"],
  ["Me", "/creator/me"],
] as const;

export function CreatorNav() {
  const pathname = usePathname();
  return (
    <nav className="creator-bottom-nav" aria-label="Creator navigation">
      {items.map(([label, href]) => {
        const active = href === "/creator" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} data-active={active}>{label}</Link>;
      })}
    </nav>
  );
}
