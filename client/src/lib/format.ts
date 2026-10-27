import { format } from 'date-fns';
import { kgToLb, mlToFlOz, roundForDisplay, type NutrientKey, type UserProfile } from '@nutritrack/shared';

/** Parses YYYY-MM-DD as a LOCAL calendar date for display only (never for arithmetic). */
export function dateFromString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(value: string, pattern = 'EEE, d MMM yyyy') {
  return format(dateFromString(value), pattern);
}

export function formatNutrient(value: number | null | undefined, key: NutrientKey = 'protein'): string {
  return roundForDisplay(value ?? null, key);
}

export function formatKcal(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${roundForDisplay(value, 'calories')}`;
}

export function formatWater(ml: number, units: UserProfile['unitSystem'] = 'metric') {
  if (units === 'imperial') return `${Math.round(mlToFlOz(ml))} fl oz`;
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, '')} L` : `${Math.round(ml)} ml`;
}

export function formatWeight(kg: number, units: UserProfile['unitSystem'] = 'metric') {
  return units === 'imperial' ? `${kgToLb(kg).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;
}

export function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d ago` : format(new Date(iso), 'd MMM');
}
