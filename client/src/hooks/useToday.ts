import { useEffect, useReducer } from 'react';
import { todayInTimeZone } from '@nutritrack/shared';
import { useMe } from '@/services/auth';

/** Today's date in the user's profile time zone; re-evaluated every minute so it rolls over at local midnight. */
export function useToday(): string {
  const { data: user } = useMe();
  const tz = user?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return todayInTimeZone(tz);
}
