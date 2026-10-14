'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminDestination, adminDestinations } from './admin-navigation';
import styles from './admin-navigation.module.css';
export function AdminLocation() {
  const path = usePathname();
  const destination = adminDestinations.find(item => item.href === adminDestination(path))!;
  const nested = path !== destination.href && !(destination.href === '/admin/creators' && path === '/admin/discover');
  return <nav className={styles.context} aria-label="Current section">
    {nested ? <Link href={destination.href}>← {destination.label}</Link> : <span>{destination.label}</span>}
    {path === '/admin/discover' && <><span aria-hidden="true">/</span><span>Discover</span></>}
  </nav>;
}
