import { LogoMark } from '../layout/Logo';

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page" role="status" aria-live="polite">
      <LogoMark className="animate-pulse" />
      <span className="text-sm text-muted">Loading NutriTrack…</span>
    </div>
  );
}
