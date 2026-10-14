import { requireAdminContext } from '@/auth/admin-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadCreators } from '@/discover/data';
import { DiscoverWorkspace } from '@/components/admin/discover/workspace';

export default async function DiscoverPage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  let props;
  try {
    const [data, capability] = await Promise.all([
      loadCreators(supabase, context.companyId),
      supabase.rpc('discover_import_ready', { p_company_id: context.companyId }),
    ]);
    props = { ...data, importReady: !capability.error && capability.data === true };
  } catch (e) {
    props = { records: [], total: 0, truncated: false, importReady: false, error: e instanceof Error ? e.message : 'Creator data could not be loaded.' };
  }
  return <DiscoverWorkspace {...props} />;
}
