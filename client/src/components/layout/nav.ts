import { BarChart3, Bell, CalendarDays, ChefHat, LayoutDashboard, NotebookPen, Scale, Search, Settings, Star, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  shortcut?: string;
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, shortcut: 'g d', mobile: true },
  { to: '/search', label: 'Food search', short: 'Search', icon: Search, shortcut: 'g s', mobile: true },
  { to: '/diary', label: 'Food diary', short: 'Diary', icon: NotebookPen, shortcut: 'g f', mobile: true },
  { to: '/calendar', label: 'Calendar & history', short: 'Calendar', icon: CalendarDays, shortcut: 'g c', mobile: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, shortcut: 'g r' },
  { to: '/goals', label: 'Goals', icon: Target, shortcut: 'g g' },
  { to: '/recipes', label: 'Recipes & meals', icon: ChefHat, shortcut: 'g m' },
  { to: '/foods', label: 'Favorites & my foods', icon: Star, shortcut: 'g v' },
  { to: '/tracking', label: 'Weight & water', icon: Scale, shortcut: 'g w' },
  { to: '/notifications', label: 'Notifications', icon: Bell, shortcut: 'g n' },
  { to: '/settings', label: 'Settings', icon: Settings, shortcut: 'g p' },
];

export function titleForPath(pathname: string): string {
  const item = NAV_ITEMS.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  return item?.label ?? 'NutriTrack';
}
