import { emptyFields, instagramHandle, type Fields, type Cell } from './import';
export type Social = { profile_url: string; handle: string | null; platform: string | null; verification_status: string; metadata: unknown; updated_at: string };
export type CreatorRecord = { id: string; primaryHandle: string | null; fields: Fields; handle: string | null; socials: Social[]; updatedAt: string; importedAt: string | null; filename: string | null; sheet: string | null; row: number | null; raw: Cell[] | null; headers: string[]; metricProvenance: string; metricCapturedAt: string | null; onboarding: Record<string, unknown>; creatorMetadata: Record<string, unknown> };
export const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function toCreatorRecord(relationship: { creator_id: string; source: string | null; metadata: unknown; updated_at: string }, creator: { display_name: string | null; primary_handle: string | null; metadata: unknown; updated_at: string }, socials: Social[], account?: { phone: string | null; onboarding_data: unknown; updated_at: string }): CreatorRecord {
  const imported = object(object(relationship.metadata).discover);
  const values = object(imported.fields);
  const onboarding = object(account?.onboarding_data);
  const fields = emptyFields();
  for (const key of Object.keys(fields) as (keyof Fields)[]) { const v = values[key]; if (typeof v === 'string' || typeof v === 'number') fields[key] = v; }
  fields.name ??= creator.display_name;
  fields.category ??= typeof onboarding.category === 'string' ? onboarding.category : null;
  fields.location ??= typeof onboarding.city === 'string' ? onboarding.city : null;
  fields.contact ??= account?.phone ?? null;
  fields.source ??= relationship.source;
  const ig = socials.find(s => /instagram\.com/i.test(s.profile_url));
  const fb = socials.find(s => /facebook\.com/i.test(s.profile_url));
  fields.instagram ??= ig?.profile_url ?? null;
  fields.facebook ??= fb?.profile_url ?? null;
  // Asked rates are retained in the detail's onboarding data, not silently mixed
  // with the spreadsheet's content-format values whose units are unconfirmed.
  const handle = instagramHandle(fields.instagram) ?? (ig ? instagramHandle(ig.handle) : null);
  const updatedAt = [relationship.updated_at, creator.updated_at, account?.updated_at, ...socials.map(s => s.updated_at)].filter((v): v is string => !!v).sort().at(-1)!;
  return { id: relationship.creator_id, primaryHandle: creator.primary_handle, fields, handle, socials, updatedAt,
    importedAt: typeof imported.imported_at === 'string' ? imported.imported_at : null,
    filename: typeof imported.filename === 'string' ? imported.filename : null,
    sheet: typeof imported.sheet === 'string' ? imported.sheet : null,
    row: typeof imported.row === 'number' ? imported.row : null,
    raw: Array.isArray(imported.raw) ? imported.raw as Cell[] : null,
    headers: Array.isArray(imported.headers) ? imported.headers.map(String) : [],
    metricProvenance: imported.filename ? 'Imported spreadsheet; not independently verified' : 'Not recorded',
    metricCapturedAt: typeof imported.metric_captured_at === 'string' ? imported.metric_captured_at : null,
    onboarding, creatorMetadata: object(creator.metadata),
  };
}
export type Filters = { search: string; category: string; platform: string; location: string; completeness: string; sort: string; direction: string };
export const initialFilters: Filters = { search: '', category: '', platform: '', location: '', completeness: '', sort: 'updated', direction: 'desc' };
export function platforms(record: CreatorRecord): string[] {
  return [...new Set([...(record.fields.instagram ? ['Instagram'] : []), ...(record.fields.facebook ? ['Facebook'] : []), ...record.socials.map(s => s.platform || (/youtube\.com|youtu.be/.test(s.profile_url) ? 'YouTube' : /instagram\.com/.test(s.profile_url) ? 'Instagram' : /facebook\.com/.test(s.profile_url) ? 'Facebook' : 'Other')).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())])];
}
export function complete(record: CreatorRecord): boolean {
  return ['name','category','instagram','followers','views','er','reel','location','source'].every(k => record.fields[k as keyof Fields] !== null);
}
export function filterCreators(records: CreatorRecord[], f: Filters): CreatorRecord[] {
  const q = f.search.trim().toLowerCase().replace(/^@/, '');
  return records.filter(r => (!q || `${r.fields.name ?? ''} ${r.handle ?? ''} ${r.primaryHandle ?? ''} ${r.socials.map(s => `${s.handle ?? ''} ${s.profile_url}`).join(' ')}`.toLowerCase().includes(q)) && (!f.category || r.fields.category === f.category) && (!f.location || r.fields.location === f.location) && (!f.platform || platforms(r).includes(f.platform)) && (!f.completeness || (f.completeness === 'complete' ? complete(r) : !complete(r)))).sort((a,b) => {
    const left = f.sort === 'updated' ? a.updatedAt : a.fields[f.sort as keyof Fields];
    const right = f.sort === 'updated' ? b.updatedAt : b.fields[f.sort as keyof Fields];
    if (left === null || left === undefined) return right === null || right === undefined ? a.id.localeCompare(b.id) : 1;
    if (right === null || right === undefined) return -1;
    const cmp = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return (f.direction === 'asc' ? cmp : -cmp) || a.id.localeCompare(b.id);
  });
}
export function display(value: Cell, percentage = false): string {
  if (value === null || value === '') return '—';
  return typeof value === 'number' ? percentage ? `${(value * 100).toFixed(2)}%` : value.toLocaleString('en-IN', { maximumFractionDigits: 4 }) : value;
}
