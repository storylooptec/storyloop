'use client';
import { useMemo, useRef, useState } from 'react';
import { columns, safeUrl } from '@/discover/import';
import { complete, display, filterCreators, initialFilters, platforms, type CreatorRecord } from '@/discover/model';
import { CreatorImport } from './creator-import';
import styles from './workspace.module.css';

export function DiscoverWorkspace({ records, total, truncated, importReady, error }: { records: CreatorRecord[]; total: number; truncated: boolean; importReady: boolean; error?: string }) {
  const [tab, setTab] = useState('database');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CreatorRecord | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const filtered = useMemo(() => filterCreators(records, filters), [records, filters]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  const shown = filtered.slice(currentPage * 50, (currentPage + 1) * 50);
  const setFilter = (key: keyof typeof filters, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(0); };
  const options = (key: 'category' | 'location') => [...new Set(records.map(r => r.fields[key]).filter((v): v is string => typeof v === 'string' && !!v))].sort();
  function open(record: CreatorRecord) { setSelected(record); dialog.current?.showModal(); }
  return <div className={`ops-page ${styles.workspace}`}>
    <header className="ops-page-header"><div><p className="sl-system-label page-eyebrow">Creator database</p><h1 className="page-title">Discover</h1><p className="page-copy">Find creators in your company’s records. Inspect the source before making a shortlist.</p></div></header>
    <nav className="ops-tabs" aria-label="Discover views">{[['database','Creator database'],['import','Import creators'],['external','Find new creators']].map(([id,label]) => <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? 'primary-button' : 'secondary-button'} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'external' ? <section className="ops-empty"><h2>Find new creators</h2><strong>Not connected</strong><p>No external creator-search provider is wired to this workflow. Search your database or import a creator list.</p></section> : tab === 'import' ? <CreatorImport importReady={importReady} /> : <>
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error} <button type="button" className="secondary-button" onClick={() => location.reload()}>Retry</button></div> : <>
        <div className={styles.notice}>Reel Post value: original numeric value; currency and meaning await confirmation. ER is displayed as a percentage. “—” means not recorded, not zero.</div>
        {truncated && <p role="alert" className={styles.notice}>Showing {records.length.toLocaleString()} of {total.toLocaleString()} records. Filters and sorting cover this loaded subset only. Import is blocked until complete duplicate checks are available.</p>}
        <div className={styles.toolbar}>
          <label>Search creators<input type="search" placeholder="Name or social handle" value={filters.search} onChange={e => setFilter('search',e.target.value)} /></label>
          <label>Category<select aria-label="Category" value={filters.category} onChange={e => setFilter('category',e.target.value)}><option value="">All categories</option>{options('category').map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Platform<select aria-label="Platform" value={filters.platform} onChange={e => setFilter('platform',e.target.value)}><option value="">All platforms</option>{[...new Set(records.flatMap(platforms))].sort().map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Location<select aria-label="Location" value={filters.location} onChange={e => setFilter('location',e.target.value)}><option value="">All locations</option>{options('location').map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Data completeness<select aria-label="Data completeness" value={filters.completeness} onChange={e => setFilter('completeness',e.target.value)}><option value="">All records</option><option value="complete">Table fields complete</option><option value="missing">Missing table fields</option></select></label>
          <label>Sort by<select aria-label="Sort by" value={filters.sort} onChange={e => setFilter('sort',e.target.value)}>{[['updated','Last updated'],['followers','Followers'],['views','Average views'],['er','Engagement rate'],['reel','Reel Post value']].map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Order<select aria-label="Order" value={filters.direction} onChange={e => setFilter('direction',e.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
          <button type="button" className="secondary-button" onClick={() => { setFilters(initialFilters); setPage(0); }}>Clear filters</button>
        </div>
        <p className="provenance">Completeness checks name, category, Instagram URL, followers, views, ER, Reel Post value, location and source. It does not imply verification.</p>
        <p role="status">{filtered.length.toLocaleString()} matching / {records.length.toLocaleString()} loaded creators</p>
        {!records.length ? <section className="ops-empty"><h2>No creators in your database yet</h2><p>Import an XLSX/CSV list or use existing creator onboarding. The sample file has not been imported automatically.</p></section> : !filtered.length ? <section className="ops-empty"><h2>No matching creators</h2><p>Try another name or clear your filters.</p></section> : <>
          <div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Company creator database</caption><thead><tr>{['Name','Category','Instagram','Followers','Average views','ER','Reel Post value','Location','Source','Last updated'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map(r => <tr key={r.id}>
            <td><button className={styles.link} onClick={() => open(r)}>{display(r.fields.name)}</button><small className={styles.small}>{complete(r) ? 'Table fields complete' : 'Missing data'}</small></td>
            <td>{display(r.fields.category)}</td><td>{safeUrl(r.fields.instagram) ? <a href={safeUrl(r.fields.instagram)!} target="_blank" rel="noopener noreferrer">{r.handle ? `@${r.handle}` : 'Instagram profile'}</a> : '—'}</td>
            {(['followers','views','er','reel'] as const).map(k => <td key={k} className={styles.number}>{display(r.fields[k],k === 'er')}</td>)}
            <td>{display(r.fields.location)}</td><td>{display(r.fields.source)}</td><td>{new Date(r.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</td>
          </tr>)}</tbody></table></div>
          <div className={styles.pager}><span>Page {currentPage + 1} of {Math.max(1,Math.ceil(filtered.length / 50))}</span><div><button className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button> <button className="secondary-button" disabled={(currentPage + 1) * 50 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
        </>}
      </>}
    </>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="creator-detail-title">
      {selected && <><div className={styles.pager}><h2 id="creator-detail-title">{display(selected.fields.name)}</h2><button className="secondary-button" onClick={() => dialog.current?.close()}>Close details</button></div>
        <p>Content-format values retain their source meaning. Currency and whether these are rates remain unconfirmed.</p>
        <dl className={styles.detail}>{columns.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{['instagram','facebook'].includes(key) && safeUrl(selected.fields[key]) ? <a href={safeUrl(selected.fields[key])!} target="_blank" rel="noopener noreferrer">{String(selected.fields[key])}</a> : display(selected.fields[key],key === 'er')}</dd></div>)}</dl>
        <h3>Provenance and timestamps</h3><dl className={styles.detail}><div><dt>Metric source</dt><dd>{selected.metricProvenance}</dd></div><div><dt>Metrics measured at</dt><dd>{selected.metricCapturedAt ?? 'Not supplied'}</dd></div><div><dt>Imported at</dt><dd>{selected.importedAt ?? 'Not imported'}</dd></div><div><dt>Record last updated (UTC)</dt><dd>{selected.updatedAt}</dd></div><div><dt>File / sheet / worksheet row</dt><dd>{selected.filename ? `${selected.filename} / ${selected.sheet} / ${selected.row}` : 'Not recorded'}</dd></div></dl>
        <h3>Social profiles</h3>{selected.socials.length ? selected.socials.map((s,i) => <div key={i}><p>{s.platform ?? 'Platform not recorded'} · {s.verification_status} · updated {s.updated_at}</p>{safeUrl(s.profile_url) ? <a href={safeUrl(s.profile_url)!} target="_blank" rel="noopener noreferrer">{s.profile_url}</a> : <span>{s.profile_url}</span>}<details><summary>Available profile metadata</summary><pre>{JSON.stringify(s.metadata,null,2)}</pre></details></div>) : <p>No social profiles recorded.</p>}
        {selected.raw && <details><summary>Original source row</summary><dl className={styles.detail}>{selected.headers.map((header,i) => <div key={i}><dt>{header || `Column ${i+1}`}</dt><dd>{selected.raw?.[i] === null ? '—' : String(selected.raw?.[i] ?? '')}</dd></div>)}</dl></details>}
        <details><summary>Other available creator and onboarding fields</summary><p>Original stored values; no demographic, rate or metric assumptions are applied.</p><pre>{JSON.stringify({ creator: selected.creatorMetadata, onboarding: selected.onboarding },null,2)}</pre></details>
      </>}
    </dialog>
  </div>;
}
