import { IllustrativeNote } from "@/components/admin/illustrative-note";

const needsYou = [
  {
    title: "Northstar Beauty — enquiry #214",
    detail: "Reply due · brief already drafted",
    meta: "2h",
    action: "Review & send",
  },
  {
    title: "Fieldnote deal — brand countered",
    detail: "Draft counter ready",
    meta: "₹12,000",
    action: "Review draft",
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
  showAction = false,
}: {
  title: string;
  rows: Array<{ title: string; detail: string; meta: string; action?: string }>;
  showAction?: boolean;
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
            {showAction && index === 0 && row.action ? (
              <button className="primary-button" type="button">
                {row.action}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TodayPage() {
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

      <QueueGroup title="Needs you · 2" rows={needsYou} showAction />
      <QueueGroup title="Waiting on others · 1" rows={waiting} />
      <QueueGroup title="Later · 1" rows={later} />

      <aside className="minute-counter">
        <span className="sl-system-label">This week, manual work</span>
        <strong>41 min / campaign</strong>
      </aside>
    </div>
  );
}
