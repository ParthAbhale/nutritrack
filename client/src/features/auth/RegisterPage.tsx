import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { registerSchema } from '@nutritrack/shared';
import { useRegister } from '@/services/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineError } from '@/components/feedback/states';
import { AuthLayout } from './AuthLayout';
import { PasswordInput, StrengthMeter } from './PasswordInput';

const formSchema = registerSchema
  .extend({ confirmPassword: z.string(), acceptTerms: z.boolean() })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((v) => v.acceptTerms, { message: 'You must accept the terms and privacy policy', path: ['acceptTerms'] });
type FormValues = z.input<typeof formSchema>;

export default function RegisterPage() {
  const reg = useRegister();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, watch, setError } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    try {
      const data = await reg.mutateAsync({ name, email, password, acceptTerms: true });
      if (data.emailSent) toast.success('Account created. Check your inbox to verify your email.');
      else toast.success('Account created', { description: data.emailNotice });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) for (const [path, message] of Object.entries(err.fieldErrors())) setError(path as keyof FormValues, { message });
    }
  });

  const err = reg.error instanceof ApiError ? reg.error : null;
  return (
    <AuthLayout title="Create your account" subtitle="Start logging meals and tracking your macros." footer={<>Already have an account? <Link to="/login" className="font-medium text-primary">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={formState.errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" {...register('name')} />}
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message} hint="At least 10 characters with upper- and lower-case letters and a number.">
          {(p) => (
            <div>
              <PasswordInput {...p} autoComplete="new-password" {...register('password')} />
              <StrengthMeter password={watch('password')} />
            </div>
          )}
        </Field>
        <Field label="Confirm password" error={formState.errors.confirmPassword?.message}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register('confirmPassword')} />}
        </Field>
        <div>
          <label className="flex items-start gap-2.5 text-[13px] text-muted">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" aria-invalid={Boolean(formState.errors.acceptTerms)} {...register('acceptTerms')} />
            <span>
              I accept the <Link to="/terms" target="_blank" className="font-medium text-primary">terms</Link> and <Link to="/privacy" target="_blank" className="font-medium text-primary">privacy policy</Link>.
            </span>
          </label>
          {formState.errors.acceptTerms && <p className="mt-1 text-xs text-danger" role="alert">{formState.errors.acceptTerms.message}</p>}
        </div>
        {err && !err.details?.length && <InlineError message={err.message} />}
        <Button type="submit" className="w-full" size="lg" loading={reg.isPending}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
