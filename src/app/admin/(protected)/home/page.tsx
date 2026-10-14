import Link from 'next/link';
import { requireAdminContext } from '@/auth/admin-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import styles from '@/components/admin/admin-navigation.module.css';

export default async function HomePage() {
  const context = await requireAdminContext();
  const supabase = await createServerSupabaseClient();
  const [creators, accounts, incomplete, revoked] = await Promise.all([
    supabase.from('company_creators').select('*', { count: 'exact', head: true }).eq('company_id', context.companyId),
    supabase.from('creator_accounts').select('*', { count: 'exact', head: true }).eq('company_id', context.companyId),
    supabase.from('creator_accounts').select('creator_id,onboarding_step,updated_at,creators(display_name,primary_handle)', { count: 'exact' }).eq('company_id', context.companyId).eq('onboarding_completed', false).order('updated_at', { ascending: true }).limit(8),
    supabase.from('creator_studio_profiles').select('creator_id,creators!inner(display_name,primary_handle,company_creators!inner(company_id))').eq('setup_status', 'revoked').eq('creators.company_creators.company_id', context.companyId).limit(8),
  ]);
  return <div className={styles.page}>
    <header className="admin-page-header"><div><h1 className="page-title">Home</h1><p className="page-copy">Your creator records and work that needs attention.</p></div></header>
    <div className={styles.actions}><Link className="primary-button" href="/admin/discover">Open Discover</Link><Link className="secondary-button" href="/admin/settings">Open Settings</Link></div>
    <section className={styles.summary} aria-label="Creator summary">
      <article><span>Creator records</span><strong>{creators.error || creators.count === null ? 'Unavailable' : creators.count}</strong><p>All company contacts, including imports. This does not confirm consent.</p></article>
      <article><span>Creator accounts</span><strong>{accounts.error || accounts.count === null ? 'Unavailable' : accounts.count}</strong><p>Creators with an account. Imported contacts may not have one.</p></article>
      <article><span>Incomplete onboarding</span><strong>{incomplete.error || incomplete.count === null ? 'Unavailable' : incomplete.count}</strong><p>Accounts that have not finished onboarding.</p></article>
    </section>
    {(creators.error || accounts.error || incomplete.error || revoked.error) && <div className={styles.notice} role="alert">Some creator information could not be loaded. <Link href="/admin/home">Retry</Link>. Unavailable figures are not zero.</div>}
    <section className={styles.notice}><h2>Needs attention</h2>
      {incomplete.error ? <p>The onboarding list is unavailable. Try again.</p> : incomplete.data?.length ? <>
        <p>Showing up to eight incomplete accounts, oldest updated first.</p>
        <div className="queue-list">{incomplete.data.map(row => {
          const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
          return <div className="queue-row" key={row.creator_id}><div className="queue-copy"><strong>{creator?.display_name ?? creator?.primary_handle ?? 'Unnamed creator'}</strong><span>Onboarding incomplete · step {row.onboarding_step}/9</span></div><Link className="secondary-button" href={`/admin/creators/${row.creator_id}`}>View creator</Link></div>;
        })}</div>
      </> : <p>No incomplete creator accounts found.</p>}
    </section>
    <section className={styles.notice}><h2>Revoked studio consent</h2>
      {revoked.error ? <p role="alert">Consent alerts could not be loaded. <Link href="/admin/home">Retry</Link>.</p> : revoked.data?.length ? <><p>Generation must remain blocked for these creators. Showing up to eight records.</p><div className="queue-list">{revoked.data.map(row => {
        const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
        return <div className="queue-row" key={row.creator_id}><div className="queue-copy"><strong>{creator?.display_name ?? creator?.primary_handle ?? 'Unnamed creator'}</strong><span>Studio consent revoked</span></div><Link className="secondary-button" href={`/admin/creators/${row.creator_id}`}>View creator</Link></div>;
      })}</div></> : <p>No revoked studio consent found in your company records.</p>}
    </section>
    <section><h2>Working with creators</h2><p>Use Discover to search your database, view creator details, or import an XLSX/CSV file. File preview and saving are separate steps; the import summary confirms which rows were saved.</p></section>
  </div>;
}
