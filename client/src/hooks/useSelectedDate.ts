import { useDateStore } from '@/lib/stores';
import { useToday } from './useToday';

/** The diary date in focus across dashboard, diary and right panel. */
export function useSelectedDate(): [string, (date: string | null) => void, string] {
  const today = useToday();
  const { selectedDate, setSelectedDate } = useDateStore();
  return [selectedDate ?? today, setSelectedDate, today];
}
