import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/layout/nav';
import { useAddFoodStore, useUiStore } from '@/lib/stores';

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
}

/**
 * Global shortcuts: Ctrl/⌘+K or "/" opens food search, "a" adds food,
 * "g" then a letter navigates, "?" shows help. Ignored while typing in fields
 * or when a dialog already has focus-trapped content open.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const openAddFood = useAddFoodStore((s) => s.openAddFood);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openAddFood();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const item = NAV_ITEMS.find((n) => n.shortcut === `g ${e.key.toLowerCase()}`);
        if (item) {
          e.preventDefault();
          navigate(item.to);
        }
        return;
      }
      if (e.key === 'g') pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
      else if (e.key === '/' || e.key === 'a') {
        e.preventDefault();
        openAddFood();
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, openAddFood, setShortcutsOpen]);
}
