import styles from '@/components/admin/admin-navigation.module.css';
export default function BrandsPage() {
  return <div className={styles.page}><header><h1 className="page-title">Brands & enquiries</h1><p className="page-copy">Brand records and incoming requests for the team.</p></header><section className={styles.notice}><h2>Admin brand management is not connected yet</h2><p>This admin view does not currently load brand records or enquiries. No records or counts are shown here until it is connected.</p></section></div>;
}
