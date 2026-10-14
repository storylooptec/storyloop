export const adminDestinations = [
  { label: 'Home', href: '/admin/home' },
  { label: 'Creators', href: '/admin/creators' },
  { label: 'Brands & enquiries', href: '/admin/brands' },
  { label: 'Campaigns', href: '/admin/campaigns' },
  { label: 'Settings', href: '/admin/settings' },
] as const;

export function adminDestination(path: string) {
  if (path === '/admin/settings/campaign-metrics' || path.startsWith('/admin/campaigns') || path === '/admin/money') return '/admin/campaigns';
  if (path.startsWith('/admin/settings')) return '/admin/settings';
  if (path.startsWith('/admin/creators') || path.startsWith('/admin/discover') || path === '/admin/add') return '/admin/creators';
  if (path.startsWith('/admin/brands')) return '/admin/brands';
  return '/admin/home';
}
