import Link from "next/link";

const experiences = [
  {
    label: "Storyloop Website",
    route: "/",
    audience: "Public",
    access: "Public",
    status: "Placeholder",
    theme: "Storyloop",
    entitlement: "None",
    exists: true,
  },
  {
    label: "Creator Hub",
    route: "/creator",
    audience: "Creators",
    access: "Authenticated experience",
    status: "Active · Demo auth",
    theme: "Storyloop",
    entitlement: "Free / Paid / Exclusive",
    exists: true,
  },
  {
    label: "Company Hub",
    route: "/company",
    audience: "Brand / company users",
    access: "Authenticated experience",
    status: "Not built",
    theme: "Storyloop",
    entitlement: "Basic / Pro",
    exists: false,
  },
  {
    label: "Storyloop Internal Workspace",
    route: "/admin",
    audience: "Storyloop team",
    access: "Supabase Auth",
    status: "Active",
    theme: "Storyloop",
    entitlement: "Junior / Senior",
    exists: true,
  },
];

export default function ExperiencesPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Platform / Surfaces</p>
          <h1 className="page-title">Experiences</h1>
          <p className="page-copy">
            A high-level map of Storyloop product surfaces, their audiences, access models and current build status. This is not a page builder.
          </p>
        </div>
      </header>

      <div className="experience-list">
        {experiences.map((experience) => (
          <article className="experience-row" key={experience.route}>
            <div className="experience-primary">
              <span className="sl-system-label">{experience.status}</span>
              <h2>{experience.label}</h2>
              <code>{experience.route}</code>
            </div>
            <dl>
              <div><dt>Audience</dt><dd>{experience.audience}</dd></div>
              <div><dt>Access</dt><dd>{experience.access}</dd></div>
              <div><dt>Theme</dt><dd>{experience.theme}</dd></div>
              <div><dt>Entitlement</dt><dd>{experience.entitlement}</dd></div>
            </dl>
            {experience.exists ? (
              <Link className="secondary-button experience-open" href={experience.route}>
                {experience.route === "/admin" ? "Open" : "Preview"}
              </Link>
            ) : (
              <span className="experience-unavailable">No route yet</span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
