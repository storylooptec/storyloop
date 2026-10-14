export const adminDestinations = [
  { label: 'Home', href: '/admin/home', children: [{ label: 'Overview & alerts', href: '/admin/home' }] },
  { label: 'Creators', href: '/admin/creators', children: [{ label: 'Discover', href: '/admin/discover' }] },
  { label: 'Brands & enquiries', href: '/admin/brands', children: [{ label: 'Brands & enquiries overview', href: '/admin/brands' }] },
  { label: 'Campaigns', href: '/admin/campaigns', children: [{ label: 'Campaign overview', href: '/admin/campaigns' }, { label: 'Campaign measurements', href: '/admin/settings/campaign-metrics' }, { label: 'Financial records', href: '/admin/money' }] },
  { label: 'Settings', href: '/admin/settings', children: [
    { label: 'Settings overview', href: '/admin/settings' },
    { label: 'Company', href: '/admin/settings/company' },
    { label: 'Team & roles', href: '/admin/settings/team' },
    { label: 'Creator content', href: '/admin/settings/creator-experience' },
    { label: 'Brand & appearance', href: '/admin/settings/brand' },
    { label: 'Product links', href: '/admin/settings/experiences' },
    { label: 'Templates', href: '/admin/settings/templates' },
    { label: 'Integration modes', href: '/admin/settings/integrations' },
    { label: 'API health & spend', href: '/admin/settings/api-health' },
    { label: 'Configuration', href: '/admin/settings/configuration' },
    { label: 'Activity log', href: '/admin/settings/audit' },
  ] },
] as const;

export function adminDestination(path: string) {
  if (path === '/admin/settings/campaign-metrics' || path.startsWith('/admin/campaigns') || path === '/admin/money') return '/admin/campaigns';
  if (path.startsWith('/admin/settings')) return '/admin/settings';
  if (path.startsWith('/admin/creators') || path.startsWith('/admin/discover') || path === '/admin/add') return '/admin/creators';
  if (path.startsWith('/admin/brands')) return '/admin/brands';
  return '/admin/home';
}
