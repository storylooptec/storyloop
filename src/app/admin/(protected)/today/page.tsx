import { requireAdminContext } from "@/auth/admin-context";
import { IllustrativeNote } from "@/components/admin/illustrative-note";

const needsYou = [
  {
    title: "Northstar Beauty — enquiry #214",
    detail: "Reply due · brief already drafted",
    meta: "2h",
  },
  {
    title: "Fieldnote deal — brand countered",
    detail: "Draft counter ready",
    meta: "₹12,000",
  },
];

const waiting = [
  { title: "Harbour Works — room build", detail: "Waiting on pipeline", meta: "Thu" },
];

const later = [
  { title: "Trail & Tide invoice #88", detail: "Sent · ageing", meta: "45d ⚠" },
];

function QueueGroup({
  title,
  rows,
  primaryLabel,
}: {
  title: string;
  rows: Array<{ title: string; detail: string; meta: string }>;
  primaryLabel?: string;
}) {
  return (
    <section className="ops-panel">
      <div className="ops-panel-heading sl-system-label">{title}</div>
      <div className="queue-list">
        {rows.map((row, index) => (
          <div className="queue-row" key={row.title}>
            <span className="queue-dot" aria-hidden="true" />
            <div className="queue-copy">
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </div>
            <span className="queue-meta">{row.meta}</span>
            {index === 0 && primaryLabel ? (
              <button className={primaryLabel === "Review & send" ? "primary-button" : "secondary-button"} type="button">
                {primaryLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function TodayPage() {
  const context = await requireAdminContext();
  const primaryLabel = context.role === "senior" ? "Review & send" : "Save draft";

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Today · needs you first</p>
          <h1 className="page-title">Today</h1>
          <p className="page-copy">
            One ordered queue. Needs you, waiting on others, then later.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <QueueGroup title="Needs you · 2" rows={needsYou} primaryLabel={primaryLabel} />
      <QueueGroup title="Waiting on others · 1" rows={waiting} />
      <QueueGroup title="Later · 1" rows={later} />

      <aside className="minute-counter">
        <span className="sl-system-label">This week, manual work</span>
        <strong>41 min / campaign</strong>
      </aside>
    </div>
  );
}
