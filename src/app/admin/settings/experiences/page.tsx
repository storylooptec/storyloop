import Link from 'next/link';
import styles from '@/components/admin/admin-navigation.module.css';
export default function ExperiencesPage() {
  return <div className={styles.page}><header><h1 className="page-title">Product links</h1><p className="page-copy">Open another Storyloop experience. Each keeps its own access requirements.</p></header><section className={styles.group}><Link href="/">Storyloop website</Link><Link href="/creator">Creator Hub</Link><Link href="/brand">Brand workspace</Link></section></div>;
}
