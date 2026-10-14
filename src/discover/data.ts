import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { toCreatorRecord, type CreatorRecord, type Social } from './model';

async function loadSocials(supabase: SupabaseClient<Database>, ids: string[]) {
  const data: (Social & { creator_id: string })[] = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    const page = await supabase.from('creator_social_accounts')
      .select('creator_id,profile_url,handle,platform,verification_status,metadata,updated_at')
      .in('creator_id', ids).order('id').range(offset, offset + 499);
    if (page.error) throw new Error('Creator social accounts could not be loaded. No partial dataset is shown.');
    data.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 500) return data;
  }
  throw new Error('Too many social accounts to load safely. No partial dataset is shown.');
}

// Fetch in bounded batches to avoid Supabase's default row limit silently hiding records.
export async function loadCreators(supabase: SupabaseClient<Database>, companyId: string) {
  const records: CreatorRecord[] = [];
  let total = 0;
  for (let offset = 0; offset < 10000; offset += 250) {
    const result = await supabase.from('company_creators')
      .select('creator_id,source,metadata,updated_at,creators(display_name,primary_handle,metadata,updated_at)', { count: 'exact' })
      .eq('company_id', companyId).order('id').range(offset, offset + 249);
    if (result.error) throw new Error('Creator database could not be loaded. Retry or ask an administrator to check database access.');
    total = result.count ?? 0;
    const rows = result.data ?? [];
    if (!rows.length) break;
    const ids = rows.map(r => r.creator_id);
    const [socials, accounts] = await Promise.all([
      loadSocials(supabase, ids),
      supabase.from('creator_accounts').select('creator_id,phone,onboarding_data,updated_at').eq('company_id', companyId).in('creator_id', ids),
    ]);
    if (accounts.error) throw new Error('Creator details could not be loaded. No partial dataset is shown.');
    for (const row of rows) {
      const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
      if (!creator) throw new Error('A linked creator could not be read. Check the creator read policies.');
      records.push(toCreatorRecord(row, creator, socials.filter(s => s.creator_id === row.creator_id), accounts.data?.find(a => a.creator_id === row.creator_id)));
    }
    if (rows.length < 250) break;
  }
  return { records, total, truncated: total > records.length };
}
