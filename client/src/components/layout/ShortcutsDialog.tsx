import { useUiStore } from '@/lib/stores';
import { Dialog, DialogContent } from '../ui/dialog';
import { NAV_ITEMS } from './nav';

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink">{children}</kbd>
);

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUiStore();
  const rows: [React.ReactNode, string][] = [
    [<><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>K</Kbd></>, 'Search and add food'],
    [<Kbd>/</Kbd>, 'Search and add food'],
    [<Kbd>a</Kbd>, 'Add food'],
    [<Kbd>?</Kbd>, 'Show this help'],
    ...NAV_ITEMS.filter((n) => n.shortcut).map((n): [React.ReactNode, string] => [<><Kbd>g</Kbd> then <Kbd>{n.shortcut!.slice(2)}</Kbd></>, `Go to ${n.label}`]),
    [<><Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd></>, 'Move between calendar days'],
    [<><Kbd>PgUp</Kbd> <Kbd>PgDn</Kbd></>, 'Previous / next month in the calendar'],
  ];
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent title="Keyboard shortcuts" description="Shortcuts are disabled while typing in a field.">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-line">
            {rows.map(([keys, label], i) => (
              <tr key={i}>
                <td className="py-2 pr-4 text-muted">{label}</td>
                <td className="py-2 text-right whitespace-nowrap">{keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
