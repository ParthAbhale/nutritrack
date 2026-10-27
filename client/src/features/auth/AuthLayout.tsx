import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Card } from '@/components/ui/card';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-page px-4 py-10">
      <Link to="/" className="mb-8" aria-label="NutriTrack home">
        <Logo />
      </Link>
      <main className="w-full max-w-[420px]">
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </main>
      <footer className="mt-auto pt-10 text-[12px] text-subtle">
        <Link to="/privacy" className="hover:text-ink">Privacy</Link> · <Link to="/terms" className="hover:text-ink">Terms</Link>
      </footer>
    </div>
  );
}
