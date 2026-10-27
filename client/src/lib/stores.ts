import { create } from 'zustand';
import type { FoodItem, Meal } from '@nutritrack/shared';

/**
 * Small client-only UI state. Server data lives in TanStack Query; nothing
 * here is persisted as a source of truth.
 */
interface DateState {
  /** Selected diary date (YYYY-MM-DD); null = follow "today". */
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
}
export const useDateStore = create<DateState>((set) => ({ selectedDate: null, setSelectedDate: (selectedDate) => set({ selectedDate }) }));

interface AddFoodState {
  open: boolean;
  meal: Meal;
  date: string | null;
  food: FoodItem | null;
  openAddFood: (opts?: { meal?: Meal; date?: string | null; food?: FoodItem | null }) => void;
  close: () => void;
}
export const useAddFoodStore = create<AddFoodState>((set) => ({
  open: false,
  meal: 'breakfast',
  date: null,
  food: null,
  openAddFood: (opts) => set({ open: true, meal: opts?.meal ?? suggestMeal(), date: opts?.date ?? null, food: opts?.food ?? null }),
  close: () => set({ open: false, food: null }),
}));

interface UiState {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  rightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
}
export const useUiStore = create<UiState>((set) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  rightPanelCollapsed: false,
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
}));

/** Picks a sensible default meal from the local time of day. */
export function suggestMeal(now = new Date()): Meal {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}
