import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@nutritrack/shared';
import { useLogin } from '@/services/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineError, Notice } from '@/components/feedback/states';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { safeRedirect } from './redirect';

export default function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const expired = params.get('reason') === 'expired';
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const redirect = safeRedirect((location.state as { from?: string } | null)?.from ?? params.get('next'));

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await login.mutateAsync(values);
      navigate(data.user.onboardingCompleted ? redirect : '/onboarding', { replace: true });
    } catch {
      /* rendered below */
    }
  });

  const err = login.error instanceof ApiError ? login.error : null;
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue tracking your nutrition." footer={<>New to NutriTrack? <Link to="/register" className="font-medium text-primary">Create an account</Link></>}>
      {expired && <div className="mb-4"><Notice>Your session ended. Please sign in again.</Notice></div>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" {...register('password')} />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[13px] font-medium text-primary">Forgot password?</Link>
        </div>
        {err && <InlineError message={err.message} />}
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
