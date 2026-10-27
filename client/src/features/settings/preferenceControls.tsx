import { useMemo, useState } from 'react';
import { type ALLERGENS, type DIETARY_PREFERENCES, cmToIn, inToCm, kgToLb, lbToKg, type Meal, type MealSetting, type UserProfile } from '@nutritrack/shared';
import { cn } from '@/lib/utils';
import { Input, Label, Select } from '@/components/ui/input';

/* Shared form controls for onboarding and settings. Canonical units: cm, kg. */

export const DIET_LABELS: Record<(typeof DIETARY_PREFERENCES)[number], string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  gluten_free: 'Gluten-free',
  dairy_free: 'Dairy-free',
  halal: 'Halal',
  kosher: 'Kosher',
  low_carb: 'Low-carb',
};

export const ALLERGEN_LABELS: Record<(typeof ALLERGENS)[number], string> = {
  gluten: 'Gluten',
  milk: 'Milk',
  eggs: 'Eggs',
  nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  soybeans: 'Soy',
  fish: 'Fish',
  crustaceans: 'Crustaceans',
  molluscs: 'Molluscs',
  'sesame-seeds': 'Sesame',
  celery: 'Celery',
  mustard: 'Mustard',
  lupin: 'Lupin',
  'sulphur-dioxide-and-sulphites': 'Sulphites',
};

export const SEX_OPTIONS: { value: UserProfile['sex']; label: string }[] = [
  { value: 'unspecified', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

/** Accessible multi-select rendered as toggle chips (checkbox semantics). */
export function ChipMultiSelect<T extends string>({ legend, options, labels, value, onChange, hint }: { legend: string; options: readonly T[]; labels: Record<T, string>; value: string[]; onChange: (next: T[]) => void; hint?: string }) {
  const toggle = (opt: T) => onChange((value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]) as T[]);
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-ink">{legend}</legend>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <label
              key={opt}
              className={cn(
                'inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                on ? 'border-primary bg-soft font-medium text-primary' : 'border-line bg-surface text-ink hover:border-line-strong',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(opt)} />
              {labels[opt]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TimeZoneSelect({ id, value, onChange, ...aria }: { id?: string; value: string; onChange: (tz: string) => void; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  const zones = useMemo(() => {
    try {
      const list = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
      return list.includes(value) || !value ? list : [value, ...list];
    } catch {
      return [];
    }
  }, [value]);
  if (zones.length === 0) {
    return <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Asia/Kolkata" {...aria} />;
  }
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...aria}>
      {zones.map((z) => (
        <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
      ))}
    </Select>
  );
}

/** Height entry in cm, or feet + inches; returns cm as a string-backed value. */
export function HeightInput({ id, units, cm, onChange, ...aria }: { id?: string; units: UserProfile['unitSystem']; cm: string; onChange: (cm: string) => void; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  if (units === 'metric') {
    return (
      <div className="relative">
        <Input id={id} inputMode="decimal" value={cm} onChange={(e) => onChange(e.target.value)} className="pr-10" {...aria} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">cm</span>
      </div>
    );
  }
  return <ImperialHeight id={id} cm={cm} onChange={onChange} {...aria} />;
}

function ImperialHeight({ id, cm, onChange, ...aria }: { id?: string; cm: string; onChange: (cm: string) => void; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  const [parts, setParts] = useState(() => {
    const totalIn = cm && Number.isFinite(Number(cm)) ? cmToIn(Number(cm)) : null;
    if (totalIn === null) return { ft: '', inch: '' };
    const ft = Math.floor(totalIn / 12);
    return { ft: String(ft), inch: String(Math.round((totalIn - ft * 12) * 10) / 10) };
  });
  const { ft, inch } = parts;
  const update = (f: string, i: string) => {
    setParts({ ft: f, inch: i });
    if (f.trim() === '' && i.trim() === '') return onChange('');
    const inches = Number(f || 0) * 12 + Number(i || 0);
    onChange(Number.isFinite(inches) ? String(Math.round(inToCm(inches) * 10) / 10) : '');
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <Input id={id} inputMode="numeric" aria-label="Feet" value={ft} onChange={(e) => update(e.target.value, inch)} className="pr-9" {...aria} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">ft</span>
      </div>
      <div className="relative">
        <Input inputMode="decimal" aria-label="Inches" value={inch} onChange={(e) => update(ft, e.target.value)} className="pr-9" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">in</span>
      </div>
    </div>
  );
}

/** Weight entry in the user's unit; the value is kept in the displayed unit. */
export function WeightInput({ id, units, value, onChange, ...aria }: { id?: string; units: UserProfile['unitSystem']; value: string; onChange: (v: string) => void; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" {...aria} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{units === 'metric' ? 'kg' : 'lb'}</span>
    </div>
  );
}

export const toKg = (value: string, units: UserProfile['unitSystem']) => {
  const n = Number(value.replace(',', '.'));
  if (!value.trim() || !Number.isFinite(n)) return null;
  return units === 'metric' ? n : lbToKg(n);
};

export const fromKg = (kg: number | null | undefined, units: UserProfile['unitSystem']) =>
  kg === null || kg === undefined ? '' : String(Math.round((units === 'metric' ? kg : kgToLb(kg)) * 10) / 10);

export function MealScheduleEditor({ meals, onChange }: { meals: MealSetting[]; onChange: (meals: MealSetting[]) => void }) {
  const update = (id: Meal, patch: Partial<MealSetting>) => onChange(meals.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-ink">Meal names and times</legend>
      <p className="mt-0.5 text-xs text-muted">Times are used for optional meal reminders. Leave a time empty for no reminder.</p>
      <div className="mt-2 space-y-2">
        {meals.map((m) => (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <div>
              <Label htmlFor={`meal-${m.id}`} className="sr-only">Name for {m.id}</Label>
              <Input id={`meal-${m.id}`} value={m.name} maxLength={30} onChange={(e) => update(m.id, { name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`meal-time-${m.id}`} className="sr-only">Time for {m.name || m.id}</Label>
              <Input id={`meal-time-${m.id}`} type="time" value={m.time ?? ''} onChange={(e) => update(m.id, { time: e.target.value || null })} />
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function parseExcluded(text: string): string[] {
  return [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20).map((t) => t.slice(0, 40));
}
