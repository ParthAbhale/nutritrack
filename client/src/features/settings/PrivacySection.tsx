import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteAccount } from '@/services/users';
import { downloadFile, errorMessage } from '@/lib/api';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { InlineError } from '@/components/feedback/states';
import { PasswordInput } from '@/features/auth/PasswordInput';

const STORED: [string, string][] = [
  ['Account', 'Name, email and a salted Argon2id password hash, to sign you in.'],
  ['Profile & preferences', 'Height, optional date of birth and sex, units, time zone, meals and dietary settings, to personalise estimates and views.'],
  ['Food diary', 'Each entry with a snapshot of the food\'s nutrition at logging time, so your history never changes unexpectedly.'],
  ['Goals, water and weight', 'Your targets (with effective dates) and tracking logs, to show progress.'],
  ['Notifications & activity', 'In-app reminders (kept 90 days) and a recent-activity feed (kept 60 days).'],
  ['Sessions', 'Device sign-ins with browser name and hashed tokens, so you can sign out remotely.'],
];

export function PrivacySection() {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Your data" description="What NutriTrack stores and why. It is never sold or shared with other users." />
        <CardBody>
          <dl className="divide-y divide-line">
            {STORED.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-ink">{k}</dt>
                <dd className="text-[13px] text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] text-subtle">Read the full <Link to="/privacy" className="text-primary">privacy notice</Link>.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Export" description="Download a copy of everything stored about you." />
        <CardBody className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadFile('/users/me/export', undefined, 'nutritrack-export.json');
                toast.success('Export downloaded');
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download /> Export all data (JSON)
          </Button>
          <Link to="/reports" className={buttonVariants({ variant: 'secondary' })}>
            <FileSpreadsheet /> Export diary as CSV
          </Link>
        </CardBody>
      </Card>

      <Card className="border-danger/30">
        <CardHeader title="Delete account" description="Permanently deletes your account and all of your records. This cannot be undone." />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete my account</Button>
        </CardBody>
      </Card>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const del = useDeleteAccount();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ready = password.length > 0 && confirm === 'DELETE';
  const submit = async () => {
    if (!ready || del.isPending) return;
    setError(null);
    try {
      await del.mutateAsync(password);
      toast.success('Your account and data were deleted');
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!del.isPending) { onOpenChange(o); if (!o) { setPassword(''); setConfirm(''); setError(null); } } }}>
      <DialogContent
        title="Delete your account?"
        description="Your profile, diary, goals, recipes, favorites, water and weight logs, notifications and sessions will be permanently deleted."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={del.isPending}>Cancel</Button>
            <Button variant="danger" onClick={submit} disabled={!ready} loading={del.isPending}>Delete permanently</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          <Field label="Your password">
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label={<>Type <strong>DELETE</strong> to confirm</>}>
            {(p) => <Input {...p} autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          {error && <InlineError message={error} />}
        </form>
      </DialogContent>
    </Dialog>
  );
}
