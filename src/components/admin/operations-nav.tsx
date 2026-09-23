import Link from "next/link";

import { operationalNavigation } from "@/operations/navigation";

export function OperationsNav() {
  return (
    <div className="operations-bar">
      <nav className="operations-nav" aria-label="Storyloop operations">
        {operationalNavigation.map((item) => (
          <Link key={item.href} href={item.href} className="operations-nav-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="operations-tools">
        <Link href="/admin/add" className="primary-button operations-add">
          + Add
        </Link>
        <form action="/admin/creators" className="operations-search">
          <label className="sr-only" htmlFor="operations-search">
            Search Storyloop
          </label>
          <input
            id="operations-search"
            name="q"
            placeholder="Search in plain words…"
            autoComplete="off"
          />
        </form>
      </div>
    </div>
  );
}
