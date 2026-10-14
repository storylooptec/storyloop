'use server';
import { revalidatePath } from 'next/cache';
import { requireAdminContext } from '@/auth/admin-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadCreators } from '@/discover/data';
import { instagramHandle, previewRows, type ImportDocument, type Mapping } from '@/discover/import';
import { object } from '@/discover/model';
import { readImport } from '@/discover/files';
import type { Json } from '@/types/database.types';

export async function parseCreatorFile(form: FormData) {
  await requireAdminContext();
  try {
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 2 * 1024 * 1024) throw new Error('Choose an XLSX or CSV file up to 2 MB.');
    const result = await readImport(Buffer.from(await file.arrayBuffer()), file.name, String(form.get('sheet') || '') || undefined);
    return { ok: true as const, ...result };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'File could not be read.' }; }
}
export async function reviewCreatorImport(document: ImportDocument, mapping: Mapping) {
  const context = await requireAdminContext();
  try {
    // Validate before any database reads; never trust browser-supplied ready flags.
    previewRows(document, mapping);
    const supabase = await createServerSupabaseClient();
    const { records, truncated } = await loadCreators(supabase, context.companyId);
    if (truncated) throw new Error('The database exceeds the current 10,000-record import preview limit. Import is blocked to avoid incomplete duplicate checks.');
    const existing = new Map<string, string>();
    for (const record of records) {
      const handles = [record.handle, instagramHandle(record.primaryHandle), ...record.socials.flatMap(s => [instagramHandle(s.profile_url), s.platform?.toLowerCase() === 'instagram' ? instagramHandle(s.handle) : null])];
      for (const handle of handles) if (handle) existing.set(handle, `Already in the database: ${record.fields.name ?? handle}`);
    }
    return { ok: true as const, rows: previewRows(document, mapping, existing) };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Preview failed.' }; }
}
export type ImportOutcome = { row: number; name: string; status: string; message: string };
export async function importCreatorRows(document: ImportDocument, mapping: Mapping, selectedRows: number[]) {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const ready = await supabase.rpc('discover_import_ready', { p_company_id: context.companyId });
  if (ready.error || !ready.data) return { ok: false as const, error: 'Import is unavailable. Apply the reviewed Discover SQL and check your operations permission.' };
  const review = await reviewCreatorImport(document, mapping);
  if (!review.ok) return review;
  if (!Array.isArray(selectedRows) || selectedRows.length > 50 || selectedRows.some(n => !Number.isInteger(n))) return { ok: false as const, error: 'Import at most 50 selected rows per batch.' };
  const selected = new Set(selectedRows);
  const outcomes: ImportOutcome[] = [];
  for (const row of review.rows.filter(r => selected.has(r.row))) {
    if (row.status !== 'ready') { outcomes.push({ row: row.row, name: row.name, status: row.status, message: row.duplicate ?? row.errors.join(' ') }); continue; }
    try {
      const result = await supabase.rpc('import_discover_creator', { p_company_id: context.companyId, p_record: { fields: row.fields, raw: row.raw, headers: document.headers, row: row.row, filename: document.filename, sheet: document.sheet } as Json });
      const data = object(result.data);
      outcomes.push({ row: row.row, name: row.name, status: result.error ? 'failed' : data.status === 'imported' ? 'imported' : data.status === 'duplicate' ? 'duplicate' : 'failed', message: result.error ? 'Could not save this row. Retry; duplicate protection prevents overwrites.' : data.status === 'duplicate' ? 'Already exists; existing data preserved.' : data.status === 'imported' ? 'Saved.' : 'Unexpected response. Check the record before retrying.' });
    } catch { outcomes.push({ row: row.row, name: row.name, status: 'failed', message: 'Connection interrupted. Retry; existing data will be preserved.' }); }
  }
  revalidatePath('/admin/discover');
  return { ok: true as const, outcomes };
}
