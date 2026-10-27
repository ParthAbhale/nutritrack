import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '@/services/auth';
import { ErrorState } from '@/components/feedback/states';
import { FullPageLoader } from '@/components/feedback/FullPageLoader';

/** Gate for authenticated routes; restores the session on refresh. */
export function RequireAuth({ children, onboarding = 'required' }: { children: ReactNode; onboarding?: 'required' | 'skip' }) {
  const { data: user, isPending, isError, error, refetch } = useMe();
  const location = useLocation();
  if (isPending) return <FullPageLoader />;
  if (isError) return <div className="flex min-h-dvh items-center justify-center"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (onboarding === 'required' && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe();
  if (isPending) return <FullPageLoader />;
  if (user) return <Navigate to={user.onboardingCompleted ? '/dashboard' : '/onboarding'} replace />;
  return <>{children}</>;
}
