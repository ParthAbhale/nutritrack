import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';
import { LogoMark } from './Logo';

/** Narrow, sticky icon rail (desktop/tablet). Labels are exposed as tooltips and aria-labels. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center border-r border-line bg-surface py-4 md:flex" aria-label="Main navigation">
      <NavLink to="/dashboard" aria-label="NutriTrack home" className="mb-6">
        <LogoMark />
      </NavLink>
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              cn(
                'group relative flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-soft hover:text-primary',
                isActive && 'bg-soft text-primary before:absolute before:-left-[17px] before:h-6 before:w-[3px] before:rounded-r-full before:bg-primary',
              )
            }
          >
            <Icon className="size-[21px]" strokeWidth={1.75} aria-hidden />
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-page shadow-pop group-hover:block group-focus-visible:block">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
