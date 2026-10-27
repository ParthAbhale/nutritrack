import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Compass, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';

/** Never shows stack traces or internal details. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const chunkError = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
      <Logo />
      <TriangleAlert className="mt-6 size-10 text-danger" aria-hidden />
      <h1 className="text-xl font-semibold text-ink">{chunkError ? 'A new version is available' : 'Something went wrong'}</h1>
      <p className="max-w-md text-sm text-muted">
        {chunkError ? 'Reload the page to get the latest version of NutriTrack.' : 'An unexpected error occurred while showing this page. Your data is safe. Try reloading.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}><RefreshCw /> Reload</Button>
        <Link to="/dashboard" className={buttonVariants({ variant: 'secondary' })}>Go to dashboard</Link>
      </div>
    </div>
  );
}

export function NotFoundPage({ inShell }: { inShell?: boolean }) {
  return (
    <div className={inShell ? 'flex flex-col items-center py-20 text-center' : 'flex min-h-dvh flex-col items-center justify-center bg-page px-6 text-center'}>
      {!inShell && <Logo />}
      <Compass className="mt-6 size-10 text-primary" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-ink">Page not found</h1>
      <p className="mt-1 max-w-md text-sm text-muted">The page you're looking for doesn't exist or has moved.</p>
      <div className="mt-5 flex gap-2">
        <Link to="/dashboard" className={buttonVariants()}>Dashboard</Link>
        <Link to="/diary" className={buttonVariants({ variant: 'secondary' })}>Food diary</Link>
      </div>
    </div>
  );
}
