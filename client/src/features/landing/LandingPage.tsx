import { Link } from 'react-router-dom';
import {
  BarChart3, CalendarDays, ChefHat, Droplets, Flame, LayoutDashboard, NotebookPen, Scale, ScanBarcode, Search, Settings, Target, type LucideIcon,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/layout/Logo';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Search, title: 'Search real foods', body: 'Branded and generic foods from USDA FoodData Central, Open Food Facts and Nutritionix, depending on which sources the server has configured.' },
  { icon: ScanBarcode, title: 'Barcode lookup', body: 'Scan a package with your camera or type the digits. If no source knows the product, you are told so.' },
  { icon: Target, title: 'Serving-based macros', body: 'Pick a serving and quantity; calories, protein, carbs and fat are calculated from the source\'s per-100 g or per-serving values.' },
  { icon: CalendarDays, title: 'Calendar history', body: 'Every day you log is on a monthly calendar with totals, goal status and a full diary for any date.' },
  { icon: BarChart3, title: 'Reports & CSV export', body: 'Weekly and monthly trends, averages and goal adherence, plus a CSV of your own diary.' },
  { icon: ChefHat, title: 'Recipes & saved meals', body: 'Combine ingredients into recipes with per-portion nutrition, and re-log your usual meals in one step.' },
  { icon: Droplets, title: 'Hydration', body: 'Quick-add water, set a daily target and see your hydration history.' },
  { icon: Scale, title: 'Weight trends', body: 'Record weight over time and view the trend for any date range.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Sign in</Link>
            <Link to="/register" className={buttonVariants({ size: 'sm' })}>Create account</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:py-20">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-[12px] font-medium text-primary">
              <Flame className="size-3.5" aria-hidden /> Food, macro and diet logging
            </p>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
              Know what you eat,
              <br className="hidden sm:block" /> one meal at a time.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              NutriTrack helps you log meals from real food databases, see your calories and macros against your own targets, and look back
              at any day on a calendar.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register" className={buttonVariants({ size: 'lg' })}>Get started, it's free</Link>
              <Link to="/login" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>I have an account</Link>
            </div>
            <p className="mt-4 text-[12px] text-subtle">A student project. Nutrition data comes from third-party sources and is not medical advice.</p>
          </div>
          <DashboardIllustration />
        </section>

        <section aria-labelledby="features-heading" className="border-t border-line bg-surface py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-heading" className="text-[22px] font-semibold tracking-tight text-ink">Everything for daily tracking</h2>
            <p className="mt-1 text-sm text-muted">Built around a simple loop: search, log, review.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-[var(--radius-card)] border border-line bg-page p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-primary"><Icon className="size-5" strokeWidth={1.75} aria-hidden /></span>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">Ready to start your food diary?</h2>
          <p className="mt-1 text-sm text-muted">Set up your targets in about two minutes. You can change them any time.</p>
          <Link to="/register" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>Create your account</Link>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-muted sm:flex-row sm:px-6">
          <span>NutriTrack · food data from USDA FoodData Central, Open Food Facts (ODbL) and Nutritionix where configured.</span>
          <nav className="flex gap-4" aria-label="Legal">
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/**
 * Static, decorative preview of the dashboard layout. Every number here is an
 * illustration (captioned as such), not user data or a statistic.
 */
function DashboardIllustration() {
  const macros = [
    { label: 'Calories', value: '1,420', target: '2,000 kcal', pct: 71, color: 'bg-primary' },
    { label: 'Protein', value: '86 g', target: '120 g', pct: 72, color: 'bg-protein' },
    { label: 'Carbs', value: '150 g', target: '230 g', pct: 65, color: 'bg-carbs' },
    { label: 'Fat', value: '48 g', target: '65 g', pct: 74, color: 'bg-fat' },
  ];
  const nav = [LayoutDashboard, Search, NotebookPen, CalendarDays, BarChart3, Settings];
  return (
    <figure className="min-w-0">
      <div aria-hidden className="overflow-hidden rounded-[18px] border border-line bg-page shadow-pop">
        <div className="flex">
          <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-3 sm:flex">
            <LogoMark className="size-7 rounded-lg" />
            {nav.map((Icon, i) => (
              <span key={i} className={cn('flex size-8 items-center justify-center rounded-lg', i === 0 ? 'bg-soft text-primary' : 'text-subtle')}>
                <Icon className="size-4" />
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-ink">Good morning</p>
                <p className="text-[11px] text-muted">Daily summary</p>
              </div>
              <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-white">+ Add food</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {macros.map((m) => (
                <Card key={m.label} className="p-2.5">
                  <p className="text-[10.5px] text-muted">{m.label}</p>
                  <p className="text-[15px] font-semibold text-ink">{m.value}</p>
                  <p className="text-[10px] text-subtle">of {m.target}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-soft">
                    <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.pct}%` }} />
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <Card className="space-y-1.5 p-2.5">
                {['Breakfast', 'Lunch', 'Snacks'].map((meal, i) => (
                  <div key={meal} className="flex items-center justify-between text-[11px]">
                    <span className="text-ink">{meal}</span>
                    <span className="text-muted">{['410', '640', '370'][i]} kcal</span>
                  </div>
                ))}
              </Card>
              <Card className="hidden p-2.5 min-[420px]:block">
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 28 }, (_, i) => (
                    <span key={i} className={cn('size-3.5 rounded-[3px]', i === 17 ? 'bg-primary' : i < 17 && i % 5 !== 3 ? 'bg-soft' : 'bg-surface-2')} />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-subtle">Illustration of the dashboard layout. Values are examples, not real data.</figcaption>
    </figure>
  );
}
