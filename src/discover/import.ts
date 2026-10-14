// Shared server/client validation. Raw values are retained independently of normalized values.
export const columns = [
  ['serial', 'SR NO'], ['name', 'NAME'], ['category', 'Category'],
  ['instagram', 'INSTAGRAM URL'], ['facebook', 'FACEBOOK URL'],
  ['followers', 'INSTAGRAM FOLLOWERS'], ['views', 'TOTAL AVG VIEWS'],
  ['likes', 'TOTAL AVG LIKES'], ['er', 'ER'],
  ['gender', 'MALE/FEMALE SPLIT DEMOGRAPHIC'], ['audienceAge', 'FOLLOWER AGE DEMOGRAPHICS'],
  ['countries', 'TOP 3 COUNTRIES'], ['cities', 'TOP 3 CITIES'],
  ['story', 'STORY POST'], ['static', 'STATIC POST'], ['carousel', 'CAROUSEL POST'],
  ['video', 'VIDEO POST'], ['reel', 'REEL POST'], ['email', 'E-MAIL'],
  ['contact', 'CONTACT'], ['age', 'AGE'], ['location', 'LOCATION'],
  ['source', 'SOURCE (DIRECT / AGENCY/AGENT)'],
] as const;
export type Field = typeof columns[number][0];
export type Cell = string | number | null;
export type Mapping = Partial<Record<Field, number>>;
export type Fields = Record<Field, Cell>;
export type ImportDocument = { filename: string; sheet: string; headers: string[]; rows: Cell[][] };
export type ImportRow = { row: number; serial: Cell; name: string; handle: string | null; fields: Fields; raw: Cell[]; errors: string[]; status: 'ready' | 'invalid' | 'duplicate' | 'empty'; duplicate?: string };
export const MAX_ROWS = 500;
export const emptyFields = (): Fields => Object.fromEntries(columns.map(([key]) => [key, null])) as Fields;
const headerKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
export function suggestMapping(headers: string[]): Mapping {
  return Object.fromEntries(columns.flatMap(([key, label]) => {
    const index = headers.findIndex(h => headerKey(h) === headerKey(label));
    return index < 0 ? [] : [[key, index]];
  }));
}
export function instagramHandle(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let text = value.trim();
  if (/^(?:https?:\/\/|(?:www\.|m\.)?instagram\.com\/)/i.test(text)) {
    try {
      const url = new URL(/^https?:/i.test(text) ? text : `https://${text}`);
      if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
      text = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch { return null; }
  } else text = text.replace(/^@/, '');
  text = text.toLowerCase();
  return /^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(text) && !text.includes('..') && !['p','reel','reels','stories','explore','accounts','direct'].includes(text) ? text : null;
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
function numberValue(value: Cell): number | null {
  if (value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : NaN;
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)$/.test(text)) return NaN;
  const n = Number(text.replaceAll(',', ''));
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? n : NaN;
}
export function validateMapping(doc: ImportDocument, mapping: Mapping): string[] {
  const errors: string[] = [];
  for (const key of ['name', 'instagram'] as const) if (mapping[key] === undefined) errors.push(`Map ${key === 'name' ? 'NAME' : 'INSTAGRAM URL'}.`);
  const used = new Set<number>();
  for (const [key, index] of Object.entries(mapping)) {
    if (!columns.some(([k]) => k === key) || !Number.isInteger(index) || index! < 0 || index! >= doc.headers.length) errors.push('Invalid column mapping.');
    else if (used.has(index!)) errors.push('Each source column can only be mapped once.');
    else used.add(index!);
  }
  return errors;
}
export function validateDocument(value: unknown): asserts value is ImportDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid import document.');
  const d = value as ImportDocument;
  if (typeof d.filename !== 'string' || d.filename.length > 255 || typeof d.sheet !== 'string' || d.sheet.length > 255 || !Array.isArray(d.headers) || !d.headers.length || d.headers.length > 50 || d.headers.some(h => typeof h !== 'string' || h.length > 500) || !Array.isArray(d.rows) || !d.rows.length || d.rows.length > MAX_ROWS) throw new Error(`Use a header row and 1–${MAX_ROWS} data rows, with at most 50 columns.`);
  for (const row of d.rows) if (!Array.isArray(row) || row.length > d.headers.length || row.some(c => c !== null && (typeof c !== 'number' && typeof c !== 'string' || typeof c === 'number' && !Number.isFinite(c) || typeof c === 'string' && c.length > 2000))) throw new Error('Unsupported cell value or a cell exceeds 2,000 characters.');
}
export function previewRows(doc: ImportDocument, mapping: Mapping, existing: Map<string, string> = new Map()): ImportRow[] {
  validateDocument(doc);
  const mappingErrors = validateMapping(doc, mapping);
  if (mappingErrors.length) throw new Error(mappingErrors.join(' '));
  const rows: ImportRow[] = doc.rows.map((raw, i) => {
    const fields = emptyFields();
    for (const [key] of columns) { const index = mapping[key]; const value = index === undefined ? null : raw[index] ?? null; fields[key] = typeof value === 'string' ? value.trim() || null : value; }
    const errors: string[] = [];
    const name = String(fields.name ?? '');
    fields.name = name;
    const handle = instagramHandle(fields.instagram);
    if (!name || name.length > 160) errors.push('NAME is required (maximum 160 characters).');
    if (!handle) errors.push('INSTAGRAM URL must be a profile URL or handle, not a post link.');
    if (handle) fields.instagram = `https://www.instagram.com/${handle}/`;
    for (const key of ['followers','views','likes','story','static','carousel','video','reel','age'] as const) {
      const n = numberValue(fields[key]);
      if (Number.isNaN(n) || n !== null && ((key === 'followers' || key === 'age') && !Number.isInteger(n) || key === 'age' && n > 120)) errors.push(`${columns.find(([k]) => k === key)![1]} must be a non-negative number${key === 'age' ? ' up to 120' : ''}.`);
      else fields[key] = n;
    }
    if (fields.er !== null) {
      const percent = typeof fields.er === 'string' && fields.er.endsWith('%');
      const n = numberValue(percent ? String(fields.er).slice(0, -1).trim() : fields.er);
      const fraction = n === null ? NaN : percent ? n / 100 : n;
      if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) errors.push('ER must be a fraction from 0 to 1 or an explicit percentage, e.g. 0.0404 or 4.04%.');
      else fields.er = fraction;
    }
    if (fields.facebook !== null) {
      const url = safeUrl(fields.facebook);
      if (!url || !/^(www\.|m\.)?(facebook\.com|fb\.com)$/.test(new URL(url).hostname)) errors.push('FACEBOOK URL must be a valid Facebook URL.');
    }
    if (fields.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email))) errors.push('E-MAIL is invalid.');
    if (typeof fields.contact === 'number' && (!Number.isSafeInteger(fields.contact) || fields.contact < 0)) errors.push('CONTACT must be text or a safe whole number.');
    for (const key of ['gender','audienceAge','countries','cities'] as const) {
      // Hyphens in audience descriptions are separators (e.g. Delhi -8%). Keep text intact.
      const matches = String(fields[key] ?? '').matchAll(/(\d+(?:\.\d+)?)\s*%/g);
      if ([...matches].some(m => Number(m[1]) < 0 || Number(m[1]) > 100)) errors.push(`${columns.find(([k]) => k === key)![1]} contains a percentage outside 0–100%.`);
    }
    const empty = raw.every(c => c === null || String(c).trim() === '');
    return { row: i + 2, serial: fields.serial, name, handle, fields, raw, errors: empty ? [] : errors, status: empty ? 'empty' : errors.length ? 'invalid' : 'ready' };
  });
  const frequencies = new Map<string, number>();
  for (const row of rows) if (row.handle) frequencies.set(row.handle, (frequencies.get(row.handle) ?? 0) + 1);
  for (const row of rows) if (row.handle && row.status !== 'empty') {
    const duplicate = existing.get(row.handle) ?? ((frequencies.get(row.handle) ?? 0) > 1 ? 'Repeated Instagram profile in this file; resolve before importing.' : undefined);
    if (duplicate) { row.duplicate = duplicate; if (row.status === 'ready') row.status = 'duplicate'; }
  }
  return rows;
}
