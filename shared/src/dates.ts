/**
 * Date-only helpers.
 *
 * Daily records (diary entries, hydration, weight, goals) are keyed by a
 * canonical local calendar date string `YYYY-MM-DD` in the user's time zone.
 * These helpers never construct a `Date` from a date-only string in local time,
 * so a date can never shift by a day because of the machine's UTC offset.
 */

export type DateString = string; // YYYY-MM-DD

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-12
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = lengths[month - 1];
  if (days === undefined) throw new RangeError(`Invalid month: ${month}`);
  return days;
}

export function parseDateString(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidDateString(value: unknown): value is DateString {
  return typeof value === 'string' && parseDateString(value) !== null;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function toDateString(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function requireParts(value: DateString) {
  const parts = parseDateString(value);
  if (!parts) throw new RangeError(`Invalid date string: ${value}`);
  return parts;
}

/** Days since 1970-01-01 using pure UTC arithmetic. */
function toEpochDay(value: DateString): number {
  const { year, month, day } = requireParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function fromEpochDay(epochDay: number): DateString {
  const d = new Date(epochDay * 86_400_000);
  return toDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(value: DateString, days: number): DateString {
  return fromEpochDay(toEpochDay(value) + days);
}

export function diffInDays(later: DateString, earlier: DateString): number {
  return toEpochDay(later) - toEpochDay(earlier);
}

export function compareDates(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0; // lexical order equals chronological order for YYYY-MM-DD
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(value: DateString): number {
  const { year, month, day } = requireParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthBounds(year: number, month: number): { from: DateString; to: DateString } {
  return { from: toDateString(year, month, 1), to: toDateString(year, month, daysInMonth(year, month)) };
}

export function eachDate(from: DateString, to: DateString): DateString[] {
  const out: DateString[] = [];
  const span = diffInDays(to, from);
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Builds a calendar grid (weeks x 7) for a month. Cells outside the month are null.
 * weekStartsOn: 0 = Sunday, 1 = Monday.
 */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0): (DateString | null)[][] {
  const first = toDateString(year, month, 1);
  const leading = (dayOfWeek(first) - weekStartsOn + 7) % 7;
  const total = daysInMonth(year, month);
  const cells: (DateString | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= total; d++) cells.push(toDateString(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DateString | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The current calendar date in an IANA time zone. Falls back to UTC for unknown zones. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): DateString {
  return dateInTimeZone(now, timeZone);
}

export function dateInTimeZone(instant: Date, timeZone: string): DateString {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return toDateString(get('year'), get('month'), get('day'));
}

/** Local wall-clock minutes since midnight in a time zone (used by reminders). */
export function minutesOfDayInTimeZone(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = formatter.formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
