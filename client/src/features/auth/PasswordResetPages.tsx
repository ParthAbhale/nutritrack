import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import { z } from 'zod';
import { forgotPasswordSchema, passwordSchema } from '@nutritrack/shared';
import { authApi } from '@/services/auth';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineError, Notice } from '@/components/feedback/states';
import { AuthLayout } from './AuthLayout';
import { PasswordInput, StrengthMeter } from './PasswordInput';

export function ForgotPasswordPage() {
  const [result, setResult] = useState<{ message: string; emailDeliveryConfigured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });
  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      setResult(await authApi.forgotPassword(email));
    } catch (err) {
      setError(errorMessage(err));
    }
  });
  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we'll send a reset link." footer={<Link to="/login" className="font-medium text-primary">Back to sign in</Link>}>
      {result ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto size-10 text-primary" />
          <p className="text-sm text-ink">{result.message}</p>
          {!result.emailDeliveryConfigured && <Notice tone="warning">Email delivery isn't configured on this server, so no email can be delivered. In development the reset link is printed to the API server log.</Notice>}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          {error && <InlineError message={error} />}
          <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetForm = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'form' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch } = useForm<z.infer<typeof resetForm>>({ resolver: zodResolver(resetForm) });
  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setState('done');
    } catch (err) {
      setError(errorMessage(err));
    }
  });
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
    return (
      <AuthLayout title="Invalid reset link">
        <div className="space-y-4 text-center">
          <XCircle className="mx-auto size-10 text-danger" />
          <p className="text-sm text-muted">This password reset link is missing or malformed.</p>
          <Link to="/forgot-password" className="font-medium text-primary">Request a new link</Link>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={state === 'done' ? 'Password updated' : 'Choose a new password'}>
      {state === 'done' ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <p className="text-sm text-muted">Your password was changed and all devices were signed out.</p>
          <Link to="/login" className="font-medium text-primary">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="New password" error={formState.errors.password?.message}>
            {(p) => (
              <div>
                <PasswordInput {...p} autoComplete="new-password" {...register('password')} />
                <StrengthMeter password={watch('password') ?? ''} />
              </div>
            )}
          </Field>
          <Field label="Confirm new password" error={formState.errors.confirm?.message}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" {...register('confirm')} />}
          </Field>
          {error && (
            <div className="space-y-2">
              <InlineError message={error} />
              <Link to="/forgot-password" className="text-[13px] font-medium text-primary">Request a new link</Link>
            </div>
          )}
          <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
