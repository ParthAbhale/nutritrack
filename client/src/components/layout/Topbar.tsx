import { useReducer } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Keyboard, LogOut, Menu, Moon, PanelRight, Search, Settings, Sun, User } from 'lucide-react';
import { toast } from 'sonner';
import { useLogout, useMe } from '@/services/auth';
import { useUpdateProfile } from '@/services/users';
import { useNotificationMutations, useNotificationPreview } from '@/services/notifications';
import { useAddFoodStore, useUiStore } from '@/lib/stores';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { applyTheme } from '@/lib/theme';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown';
import { Logo } from './Logo';
import { titleForPath } from './nav';

export function Topbar() {
  const { pathname } = useLocation();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const { setMobileNavOpen, setShortcutsOpen, toggleRightPanel } = useUiStore();
  const title = titleForPath(pathname);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}>
          <Menu />
        </Button>
        <Link to="/dashboard" className="hidden md:block" aria-label="NutriTrack home">
          <Logo />
        </Link>
        <nav aria-label="Breadcrumb" className="min-w-0 md:ml-4 md:border-l md:border-line md:pl-4">
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="hidden text-muted lg:block">NutriTrack</li>
            <li className="hidden text-subtle lg:block" aria-hidden>/</li>
            <li className="truncate font-semibold text-ink" aria-current="page">{title}</li>
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => openAddFood()}
            className="hidden h-10 w-64 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 text-sm text-subtle hover:border-line-strong sm:flex lg:w-72"
            aria-label="Search foods to log"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Search foods…</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search foods" onClick={() => openAddFood()}>
            <Search />
          </Button>
          <NotificationBell />
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="hidden xl:inline-flex" aria-label="Toggle side panel" onClick={toggleRightPanel}>
            <PanelRight />
          </Button>
          <AccountMenu onShortcuts={() => setShortcutsOpen(true)} />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { data: user } = useMe();
  const update = useUpdateProfile();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const dark = document.documentElement.classList.contains('dark');
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        applyTheme(next);
        rerender();
        if (user) update.mutate({ theme: next }, { onError: () => toast.error("Couldn't save your theme preference") });
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function NotificationBell() {
  const { data } = useNotificationPreview();
  const { setRead, readAll } = useNotificationMutations();
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-sm font-semibold text-ink">Notifications</span>
          {unread > 0 && (
            <button type="button" className="text-[12px] font-medium text-primary" onClick={() => readAll.mutate()}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!data ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted">You're all caught up.</p>
        ) : (
          data.items.map((n) => (
            <DropdownMenuItem key={n.id} className="items-start" onSelect={() => !n.read && setRead.mutate({ id: n.id, read: true })}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                <span className="block text-[12px] leading-snug text-muted">{n.body}</span>
                <span className="block text-[11px] text-subtle">{relativeTime(n.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/notifications')} className="justify-center text-primary">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex size-10 items-center justify-center rounded-full bg-soft text-[13px] font-semibold text-primary ring-offset-2 hover:ring-2 hover:ring-primary/30" aria-label="Account menu">
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-ink">{user?.name}</span>
          <span className="block truncate">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}><User /> Profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings?tab=preferences')}><Settings /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={onShortcuts}><Keyboard /> Keyboard shortcuts</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => navigate('/login', { replace: true }),
            })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
