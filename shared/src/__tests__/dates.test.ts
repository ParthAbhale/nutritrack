import { describe, expect, it } from 'vitest';
import {
  addDays, dateInTimeZone, dayOfWeek, daysInMonth, diffInDays, eachDate, isLeapYear, isValidDateString,
  monthBounds, monthGrid, shiftMonth,
} from '../dates';

describe('date-only helpers', () => {
  it('handles leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2025-02-29')).toBe(false);
  });

  it('rejects malformed values', () => {
    for (const v of ['2025-13-01', '2025-1-01', '20250101', '', null, '2025-04-31']) {
      expect(isValidDateString(v)).toBe(false);
    }
  });

  it('adds days across month and year boundaries without timezone drift', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07');
    expect(diffInDays('2026-01-01', '2025-12-01')).toBe(31);
    expect(eachDate('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('computes month bounds and shifting', () => {
    expect(monthBounds(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('aligns calendar grids to the week start', () => {
    // 1 October 2026 is a Thursday
    expect(dayOfWeek('2026-10-01')).toBe(4);
    const sundayFirst = monthGrid(2026, 10, 0);
    expect(sundayFirst[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    const mondayFirst = monthGrid(2026, 10, 1);
    expect(mondayFirst[0]?.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(sundayFirst.flat().filter(Boolean)).toHaveLength(31);
    expect(sundayFirst.every((w) => w.length === 7)).toBe(true);
  });

  it('derives the local calendar date for a time zone', () => {
    const instant = new Date('2026-10-27T23:30:00Z');
    expect(dateInTimeZone(instant, 'UTC')).toBe('2026-10-27');
    expect(dateInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-10-28');
    expect(dateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-10-27');
    expect(dateInTimeZone(instant, 'Not/AZone')).toBe('2026-10-27');
  });
});
