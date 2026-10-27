import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, Laptop, MailWarning, Smartphone } from 'lucide-react';
import { passwordSchema } from '@nutritrack/shared';
import { authApi, useCurrentUser, useRevokeSession, useSessions } from '@/services/auth';
import { keys } from '@/services/keys';
import { ApiError, errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/input';
import { ListSkeleton } from '@/components/feedback/skeletons';
import { ErrorState, InlineError } from '@/components/feedback/states';
import { PasswordInput, StrengthMeter } from '@/features/auth/PasswordInput';
import { ResendVerification } from '@/features/auth/ResendVerification';

const changeSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: 'Choose a password different from the current one', path: ['newPassword'] });
type ChangeValues = z.infer<typeof changeSchema>;

export function SecuritySection() {
  return (
    <div className="space-y-5">
      <EmailStatus />
      <ChangePassword />
      <Sessions />
    </div>
  );
}

function EmailStatus() {
  const user = useCurrentUser();
  return (
    <Card>
      <CardHeader title="Email address" description={user.email} />
      <CardBody>
        {user.emailVerified ? (
          <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Verified</p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-warning-ink"><MailWarning className="size-4" /> Not verified yet</p>
            <ResendVerification />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ChangePassword() {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch, reset, setError } = useForm<ChangeValues>({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await authApi.changePassword(v.currentPassword, v.newPassword);
      toast.success(res.message);
      reset();
      void qc.invalidateQueries({ queryKey: keys.sessions });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        for (const [path, message] of Object.entries(err.fieldErrors())) setError(path as keyof ChangeValues, { message });
      } else setFormError(errorMessage(err));
    }
  });
  return (
    <Card>
      <CardHeader title="Change password" description="Other devices are signed out after a password change." />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4 sm:max-w-md" noValidate>
          <Field label="Current password" error={formState.errors.currentPassword?.message}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" {...register('currentPassword')} />}
          </Field>
          <Field label="New password" error={formState.errors.newPassword?.message} hint="At least 10 characters with upper- and lower-case letters and a number.">
            {(p) => (
              <div>
                <PasswordInput {...p} autoComplete="new-password" {...register('newPassword')} />
                <StrengthMeter password={watch('newPassword')} />
              </div>
            )}
          </Field>
          <Field label="Confirm new password" error={formState.errors.confirm?.message}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" {...register('confirm')} />}
          </Field>
          {formError && <InlineError message={formError} />}
          <Button type="submit" loading={formState.isSubmitting}>Update password</Button>
        </form>
      </CardBody>
    </Card>
  );
}

function describeAgent(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return { label: `${browser} on ${os}`, mobile: /Mobile|iPhone|Android/.test(ua) };
}

function Sessions() {
  const { data, isPending, isError, error, refetch } = useSessions();
  const revoke = useRevokeSession();
  return (
    <Card>
      <CardHeader title="Signed-in devices" description="Sign out of devices you don't recognise." />
      <CardBody>
        {isPending ? (
          <ListSkeleton rows={2} label="Loading sessions" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((s) => {
              const agent = describeAgent(s.userAgent);
              const Icon = agent.mobile ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-soft text-primary"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {agent.label} {s.current && <Badge tone="success">This device</Badge>}
                    </p>
                    <p className="text-[12px] text-muted">Signed in {relativeTime(s.createdAt)} · last active {relativeTime(s.lastUsedAt)}</p>
                  </div>
                  {!s.current && (
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      loading={revoke.isPending && revoke.variables === s.id}
                      onClick={() => revoke.mutate(s.id, { onSuccess: () => toast.success('Device signed out'), onError: (e) => toast.error(errorMessage(e)) })}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
