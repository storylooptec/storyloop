import Link from 'next/link';
import styles from '@/components/admin/admin-navigation.module.css';
const groups = [
  { title: 'Organisation & team', links: [
    ['Company', '/admin/settings/company', 'View your company details.'],
    ['Team & roles', '/admin/settings/team', 'View team access and permissions.'],
  ] },
  { title: 'Content & appearance', links: [
    ['Creator content', '/admin/settings/creator-experience', 'Edit creator-facing copy and visibility.'],
    ['Brand & appearance', '/admin/settings/brand', 'Manage logos, colours and appearance.'],
    ['Product links', '/admin/settings/experiences', 'Open the existing Storyloop experiences.'],
    ['Templates', '/admin/settings/templates', 'Manage reusable message and document templates.'],
  ] },
  { title: 'Connections & usage', links: [
    ['Integration modes', '/admin/settings/integrations', 'Manage provider operating modes; these are not health checks.'],
    ['API health & spend', '/admin/settings/api-health', 'Review recorded requests, observed status and costs.'],
  ] },
  { title: 'Advanced', links: [
    ['Configuration', '/admin/settings/configuration', 'Manage product rules and feature switches.'],
    ['Activity log', '/admin/settings/audit', 'Review recorded administrative changes.'],
  ] },
];
export default function SettingsPage() {
  return <div className={styles.page}><header><h1 className="page-title">Settings</h1><p className="page-copy">Company, content and system controls. Your existing role determines what you can change.</p></header><div className={styles.links}>{groups.map(group => <section className={styles.group} key={group.title}><h2>{group.title}</h2>{group.links.map(([label,href,detail]) => <Link key={href} href={href}><strong>{label}</strong><span>{detail}</span></Link>)}</section>)}</div></div>;
}
