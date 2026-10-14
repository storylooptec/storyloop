import Link from 'next/link';
import styles from '@/components/admin/admin-navigation.module.css';
export default function CampaignsPage() {
  return <div className={styles.page}><header><h1 className="page-title">Campaigns</h1><p className="page-copy">Campaign tools for the operations team.</p></header><section className={styles.notice}><h2>Campaign performance</h2><p>Open an available launched campaign to record or correct its daily measurements.</p><Link className="primary-button" href="/admin/settings/campaign-metrics">Open campaign measurements</Link></section><section className={styles.notice}><h2>Campaign management is not connected here yet</h2><p>The admin campaign board is not connected to campaign records. No example campaigns or send actions are shown.</p></section></div>;
}
