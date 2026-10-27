import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddFoodStore, useUiStore } from '@/lib/stores';
import { NAV_ITEMS } from './nav';
import { Logo } from './Logo';

/** Bottom tab bar on phones, with a centered quick-add button. */
export function MobileTabBar() {
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const items = NAV_ITEMS.filter((n) => n.mobile);
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);
  const link = ({ to, label, short, icon: Icon }: (typeof items)[number]) => (
    <NavLink key={to} to={to} className={({ isActive }) => cn('flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium', isActive ? 'text-primary' : 'text-muted')}>
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
      <span className="truncate">{short ?? label}</span>
    </NavLink>
  );
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {left.map(link)}
      <div className="flex flex-1 items-center justify-center">
        <button type="button" onClick={() => openAddFood()} className="-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-pop" aria-label="Add food">
          <Plus className="size-6" />
        </button>
      </div>
      {right.map(link)}
    </nav>
  );
}

/** Full navigation drawer for phones (opened from the top bar menu button). */
export function MobileDrawer() {
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();
  return (
    <RD.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-[#0b1020]/40 md:hidden" />
        <RD.Content className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col bg-surface shadow-pop md:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Logo />
            <RD.Close className="rounded-lg p-2 text-muted hover:bg-soft" aria-label="Close menu">
              <X className="size-5" />
            </RD.Close>
          </div>
          <RD.Title className="sr-only">Navigation</RD.Title>
          <RD.Description className="sr-only">Go to a section of NutriTrack</RD.Description>
          <nav className="flex-1 overflow-y-auto p-3">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium', isActive ? 'bg-soft text-primary' : 'text-ink hover:bg-surface-2')}
              >
                <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
