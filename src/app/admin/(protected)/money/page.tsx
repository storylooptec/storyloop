import Link from 'next/link';
import styles from '@/components/admin/admin-navigation.module.css';
export default function MoneyPage() {
  return <div className={styles.page}><header><h1 className="page-title">Finance</h1></header><section className={styles.notice}><h2>Financial records are not connected</h2><p>Creator payouts, receivables and balances are unavailable in this admin view. No sample amounts are displayed.</p><Link href="/admin/campaigns">Back to Campaigns</Link></section></div>;
}
