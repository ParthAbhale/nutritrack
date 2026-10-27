import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useUiStore } from '@/lib/stores';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AddFoodDialog } from '@/features/food-search/AddFoodDialog';
import { EmailVerificationBanner } from '@/features/auth/EmailVerificationBanner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { RightPanel } from './RightPanel';
import { MobileDrawer, MobileTabBar } from './MobileNav';
import { ShortcutsDialog } from './ShortcutsDialog';
import { PageSkeleton } from './PageSkeleton';

/** Three-zone layout: icon rail · workspace · contextual panel (xl+). */
const PANEL_ROUTES = ['/dashboard', '/diary'];

export function AppShell() {
  useKeyboardShortcuts();
  const { pathname } = useLocation();
  const withRightPanel = PANEL_ROUTES.includes(pathname);
  const collapsed = useUiStore((s) => s.rightPanelCollapsed);
  return (
    <div className="flex min-h-dvh bg-page">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <EmailVerificationBanner />
        <div className="flex min-w-0 flex-1">
          <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
            <div className="mx-auto max-w-[1180px]">
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
          {withRightPanel && !collapsed && <RightPanel />}
        </div>
      </div>
      <MobileTabBar />
      <MobileDrawer />
      <AddFoodDialog />
      <ShortcutsDialog />
    </div>
  );
}
