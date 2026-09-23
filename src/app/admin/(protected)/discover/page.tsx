import { requireAdminContext } from "@/auth/admin-context";
import { IllustrativeNote } from "@/components/admin/illustrative-note";
import { ContextHelp } from "@/components/admin/context-help";
import { adminHelp } from "@/help/admin-help";

const candidates = [
  {
    name: "Illustrative Creator A",
    handle: "@creatora",
    audience: "IG / YT · 84.2K / 31K",
    views: "22,400",
    er: "2.3%",
    active: "2d",
    reason: "11 recent posts on Mumbai fashion and Indian labels",
    score: "91",
  },
  {
    name: "Illustrative Creator B",
    handle: "@creatorb",
    audience: "IG · 56.1K",
    views: "18,900",
    er: "4.7%",
    active: "5d",
    reason: "Strong Hindi-English fashion mix; found via hosted search",
    score: "86",
  },
];

export default async function DiscoverPage() {
  const context = await requireAdminContext();
  const outreachLabel = context.role === "senior" ? "Send outreach" : "Send locked template";

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div>
          <p className="sl-system-label page-eyebrow">Discovery</p>
          <h1 className="page-title">Discover</h1>
          <p className="page-copy">
            Plain words in. Expansion, sources, spend and evidence stay visible.
          </p>
        </div>
        <IllustrativeNote />
      </header>

      <section className="ops-panel discover-run">
        <label className="discover-input">
          <span className="sl-system-label">Run query</span>
          <input defaultValue="mumbai fashion, hindi+english" />
        </label>

        <div className="expansion-block">
          <span className="sl-system-label">Expands to</span>
          <div className="parsed-chips">
            <span className="query-chip">#mumbaifashion ×</span>
            <span className="query-chip">street style ×</span>
            <span className="query-chip">indian labels ×</span>
          </div>
          <p className="provenance">
            Official social APIs · hosted search · RSS · checked today · confidence high
            <ContextHelp text={adminHelp.provenance} label="About provenance" />
          </p>
        </div>

        <div className="run-meter">
          <div><span>Found</span><strong>118</strong></div>
          <div><span>Deduped</span><strong>74</strong></div>
          <div><span>Enriched</span><strong>22</strong></div>
          <div>
            <span className="field-label-with-help">Spend <ContextHelp text={adminHelp.discoveryCap} label="About the discovery cap" /></span>
            <strong>₹142 / TBD cap</strong>
          </div>
        </div>

        <button className="primary-button" type="button">Run discovery</button>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">Review queue · score ordered</div>
        <div className="candidate-grid">
          {candidates.map((candidate) => (
            <article className="candidate-card" key={candidate.handle}>
              <div className="candidate-card-head">
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.handle}</span>
                </div>
                <div className="candidate-score">
                  <span className="field-label-with-help">
                    Score
                    <ContextHelp text={adminHelp.candidateScore} label="About Storyloop score" />
                  </span>
                  <strong>{candidate.score}</strong>
                  <span>High confidence</span>
                </div>
              </div>
              <dl className="candidate-metrics">
                <div><dt>Audience</dt><dd>{candidate.audience}</dd></div>
                <div><dt>Avg views</dt><dd>{candidate.views}</dd></div>
                <div>
                  <dt className="field-label-with-help">
                    ER <ContextHelp text={adminHelp.engagementRate} label="About engagement rate" />
                  </dt>
                  <dd>{candidate.er}</dd>
                </div>
                <div><dt>Last active</dt><dd>{candidate.active}</dd></div>
              </dl>
              <p className="candidate-reason">{candidate.reason}</p>
              <p className="provenance">source · checked today · confidence high</p>
              <div className="candidate-actions">
                <button type="button">View</button>
                <button type="button">Enrich</button>
                <button type="button">Ignore</button>
                <button type="button" className="secondary-button">Add</button>
              </div>
            </article>
          ))}
        </div>

        <div className="outreach-preview">
          <div>
            <span className="sl-system-label">Add → consent outreach preview</span>
            <p>
              Storyloop here. Brands ask us for creators like you. Want in? One link,
              you set your own rates.
            </p>
            <p className="provenance">14d no reply → one nudge · archive · 90d deletion TBD/configured</p>
          </div>
          <button className="primary-button" type="button">{outreachLabel}</button>
        </div>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-heading sl-system-label">Past runs</div>
        <div className="simple-rows">
          <div><span>#30 · pune fitness · 19 added · 2d</span><button type="button">Re-run</button></div>
          <div><span>#29 · kolkata food · 7 added · 5d</span><button type="button">Re-run</button></div>
        </div>
      </section>
    </div>
  );
}
