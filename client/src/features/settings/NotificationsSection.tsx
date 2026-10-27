import { useState } from 'react';
import { toast } from 'sonner';
import type { NotificationPrefs } from '@nutritrack/shared';
import { useCapabilities, useCurrentUser } from '@/services/auth';
import { useUpdateProfile } from '@/services/users';
import { errorMessage } from '@/lib/api';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Notice } from '@/components/feedback/states';

const ROWS: { key: Exclude<keyof NotificationPrefs, 'hydrationIntervalHours'>; label: string; description: string }[] = [
  { key: 'mealReminders', label: 'Meal reminders', description: 'At each meal time from your schedule, if nothing has been logged for that meal yet.' },
  { key: 'hydrationReminders', label: 'Hydration reminders', description: 'Check-ins between 08:00 and 21:00 while you are below your water goal.' },
  { key: 'goalProgress', label: 'Goal progress', description: 'When you reach, or go more than 10% above, your daily calorie goal.' },
  { key: 'email', label: 'Email copies', description: 'Also send meal reminders by email (verified addresses only).' },
];

/** Each toggle saves immediately; the switch reverts if saving fails. */
export function NotificationsSection() {
  const user = useCurrentUser();
  const caps = useCapabilities();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useState<NotificationPrefs>(user.notifications);
  const emailAvailable = caps.data?.emailDelivery ?? false;

  const save = (next: NotificationPrefs) => {
    const previous = prefs;
    setPrefs(next);
    update.mutate(
      { notifications: next },
      {
        onSuccess: () => toast.success('Notification settings saved'),
        onError: (err) => {
          setPrefs(previous);
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader title="Notifications" description="Reminders are created by the server and appear in your notification center, so they work even when NutriTrack isn't open." />
      <CardBody className="space-y-5">
        <ul className="divide-y divide-line">
          {ROWS.map((row) => {
            const id = `notif-${row.key}`;
            const disabled = row.key === 'email' && !emailAvailable;
            return (
              <li key={row.key} className="flex items-start justify-between gap-4 py-3.5 first:pt-0">
                <div>
                  <label htmlFor={id} className="text-sm font-medium text-ink">{row.label}</label>
                  <p id={`${id}-desc`} className="text-[12.5px] text-muted">{row.description}</p>
                </div>
                <Switch id={id} aria-describedby={`${id}-desc`} checked={prefs[row.key] && !disabled} disabled={disabled || update.isPending} onCheckedChange={(v) => save({ ...prefs, [row.key]: v })} />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor="hydration-interval" className="text-[13px] font-medium text-ink">Hydration reminder interval</label>
          <Select
            id="hydration-interval"
            value={prefs.hydrationIntervalHours}
            disabled={!prefs.hydrationReminders || update.isPending}
            onChange={(e) => save({ ...prefs, hydrationIntervalHours: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 6].map((h) => <option key={h} value={h}>Every {h} hour{h > 1 ? 's' : ''}</option>)}
          </Select>
        </div>
        {caps.data && !emailAvailable && (
          <Notice tone="warning">Email delivery isn't configured on this server, so email notifications are unavailable. In-app notifications still work.</Notice>
        )}
        {emailAvailable && !user.emailVerified && prefs.email && (
          <Notice tone="warning">Verify your email address (Security tab) to receive email copies.</Notice>
        )}
      </CardBody>
    </Card>
  );
}
