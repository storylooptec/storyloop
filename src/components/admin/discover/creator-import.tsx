'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseCreatorFile, reviewCreatorImport, importCreatorRows, type ImportOutcome } from '@/app/admin/(protected)/discover/actions';
import { columns, suggestMapping, validateMapping, type ImportDocument, type ImportRow, type Mapping } from '@/discover/import';
import { display } from '@/discover/model';
import styles from './workspace.module.css';

export function CreatorImport({ importReady }: { importReady: boolean }) {
  const router = useRouter();
  const file = useRef<File | null>(null);
  const [document, setDocument] = useState<ImportDocument | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  function resetReview() { setRows(null); setSelected([]); setOutcomes(null); setError(''); }
  async function read(sheet?: string) {
    if (!file.current) return;
    setBusy('Reading file…'); resetReview(); setDocument(null);
    try {
      const form = new FormData(); form.set('file',file.current); if (sheet) form.set('sheet',sheet);
      const result = await parseCreatorFile(form);
      if (!result.ok) setError(result.error);
      else { setDocument(result.document); setSheets(result.sheets); setMapping(suggestMapping(result.document.headers)); }
    } catch { setError('File could not be read. Check your connection and try again.'); }
    finally { setBusy(''); }
  }
  async function review() {
    if (!document) return;
    resetReview(); setBusy('Validating rows and checking the database…');
    try {
      const result = await reviewCreatorImport(document,mapping);
      if (!result.ok) setError(result.error);
      else { setRows(result.rows); setSelected(result.rows.filter(r => r.status === 'ready').map(r => r.row)); }
    } catch { setError('Preview could not finish. No rows were imported.'); }
    finally { setBusy(''); }
  }
  async function save() {
    if (!document || !rows || !selected.length) return;
    setError('');
    const results: ImportOutcome[] = rows.filter(r => !selected.includes(r.row)).map(r => ({ row:r.row,name:r.name,status:r.status === 'ready' ? 'not selected' : r.status,message:r.duplicate ?? r.errors.join(' ') }));
    try {
      for (let start = 0; start < selected.length; start += 50) {
        setBusy(`Importing ${start + 1}–${Math.min(start + 50,selected.length)} of ${selected.length} selected rows…`);
        const batch = selected.slice(start,start + 50);
        const result = await importCreatorRows(document,mapping,batch);
        if (!result.ok) { setError(result.error); break; }
        results.push(...result.outcomes);
      }
    } catch { setError('Import was interrupted. Review the summary, then preview again before retrying. Saved records will be detected as duplicates.'); }
    finally {
      for (const row of rows) if (!results.some(r => r.row === row.row)) results.push({ row: row.row,name:row.name,status:'not confirmed',message:'Check the database or preview again before retrying.' });
      setOutcomes(results.sort((a,b) => a.row-b.row)); setBusy(''); router.refresh();
    }
  }
  const mappingErrors = document ? validateMapping(document,mapping) : [];
  const readyCount = rows?.filter(r => r.status === 'ready').length ?? 0;
  return <section className={styles.import} aria-label="Creator import">
    <h2>Import creators</h2><p>XLSX or CSV · up to 2 MB and 500 data rows per sheet. First row must contain column headings. NAME and Instagram profile are required.</p>
    <p>Numeric ER values are decimal fractions: 0.0404 → 4.04%. Values with a % sign are also accepted. Missing cells stay missing. All source columns are retained, including unmapped columns.</p>
    {!importReady && <div className={styles.notice} role="status">Saving is not enabled. Preview and validation are available. Apply the reviewed Discover SQL and ensure your account has operations permission before importing.</div>}
    <label>Creator file <input type="file" accept=".xlsx,.csv" disabled={!!busy} onChange={e => { file.current = e.target.files?.[0] ?? null; setSheets([]); setDocument(null); resetReview(); if (file.current) void read(); }} /></label>
    {error && <div role="alert" className={`${styles.notice} ${styles.error}`}>{error}</div>}
    {busy && <p role="status">{busy}</p>}
    {document && <>
      <div className={styles.toolbar}><label>Worksheet<select disabled={!!busy} value={document.sheet} onChange={e => void read(e.target.value)}>{sheets.map(s => <option key={s}>{s}</option>)}</select></label><p>{document.filename}: {document.rows.length} source rows, {document.headers.length} columns.</p></div>
      <h3>1. Map columns</h3>
      <div className={styles.mapping}>{columns.map(([key,label]) => <label key={key}>{label}{['name','instagram'].includes(key) ? ' *' : ''}<select aria-label={`Map ${label}`} disabled={!!busy} value={mapping[key] ?? ''} onChange={e => { resetReview(); setMapping(m => { const next = {...m}; if(e.target.value === '') delete next[key]; else next[key] = Number(e.target.value); return next; }); }}><option value="">Not mapped — retain raw value only</option>{document.headers.map((h,i) => <option key={i} value={i}>{i+1}: {h || '(blank header)'}</option>)}</select></label>)}</div>
      {mappingErrors.length > 0 && <p role="alert">{mappingErrors.join(' ')}</p>}
      <details><summary>Preview all original source cells</summary><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Worksheet row</th>{document.headers.map((h,i) => <th key={i}>{h || `Column ${i+1}`}</th>)}</tr></thead><tbody>{document.rows.map((row,i) => <tr key={i}><td>{i+2}</td>{row.map((cell,j) => <td key={j}>{cell === null ? '—' : String(cell)}</td>)}</tr>)}</tbody></table></div></details>
      <button className="secondary-button" disabled={!!busy || !!mappingErrors.length} onClick={() => void review()}>Validate and preview import</button>
      {rows && <>
        <h3>2. Review rows</h3><p role="status">{readyCount} valid new rows. {rows.length-readyCount} rows require attention or are empty. Repeated Instagram profiles in the same file are all held for review.</p>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Select</th><th>Row / SR NO</th><th>Name</th><th>Instagram</th><th>Followers</th><th>ER</th><th>Reel Post value</th><th>Status / errors</th></tr></thead><tbody>{rows.map(r => <tr key={r.row}><td><input type="checkbox" aria-label={`Import row ${r.row}`} disabled={!!busy || r.status !== 'ready' || !!outcomes} checked={selected.includes(r.row)} onChange={e => setSelected(s => e.target.checked ? [...s,r.row] : s.filter(n => n !== r.row))} /></td><td>{r.row} / {display(r.serial)}</td><td>{r.name || '—'}</td><td>{r.handle ? `@${r.handle}` : display(r.fields.instagram)}</td><td>{display(r.fields.followers)}</td><td>{display(r.fields.er,true)}</td><td>{display(r.fields.reel)}</td><td>{r.status}<small className={styles.small}>{[...r.errors,r.duplicate].filter(Boolean).join(' ')}</small></td></tr>)}</tbody></table></div>
        <p>Existing creator data is never overwritten. {selected.length} selected; {rows.length-selected.length} will not be imported. Content-format units and currency remain unconfirmed.</p>
        <button className="primary-button" disabled={!importReady || !!busy || !selected.length || !!outcomes} onClick={() => void save()}>Import {selected.length} selected creators</button>
      </>}
      {outcomes && <section aria-label="Import summary"><h3>Import summary</h3><p role="status">{[...new Set(outcomes.map(r => r.status))].map(status => `${outcomes.filter(r => r.status === status).length} ${status}`).join(' · ')}</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Worksheet row</th><th>Name</th><th>Result</th><th>Details</th></tr></thead><tbody>{outcomes.map(r => <tr key={r.row}><td>{r.row}</td><td>{r.name || '—'}</td><td>{r.status}</td><td>{r.message || 'No record written.'}</td></tr>)}</tbody></table></div><p>Preview again to resolve or retry remaining rows. Imported records will now appear as duplicates.</p></section>}
    </>}
  </section>;
}
