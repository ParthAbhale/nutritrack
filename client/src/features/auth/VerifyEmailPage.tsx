import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { authApi, useMe } from '@/services/auth';
import { ResendVerification } from './ResendVerification';
import { errorMessage } from '@/lib/api';
import { keys } from '@/services/keys';
import { AuthLayout } from './AuthLayout';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>(token ? 'pending' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token.');
  const started = useRef(false);
  const qc = useQueryClient();
  const { data: user } = useMe();

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then(() => {
        setState('ok');
        void qc.invalidateQueries({ queryKey: keys.me });
      })
      .catch((err) => {
        setState('error');
        setMessage(errorMessage(err));
      });
  }, [token, qc]);

  return (
    <AuthLayout title="Email verification">
      <div className="space-y-4 text-center" aria-live="polite">
        {state === 'pending' && (<><Loader2 className="mx-auto size-10 animate-spin text-primary" /><p className="text-sm text-muted">Verifying your email…</p></>)}
        {state === 'ok' && (<><CheckCircle2 className="mx-auto size-10 text-success" /><p className="text-sm text-ink">Your email address is verified.</p><Link to={user ? '/dashboard' : '/login'} className="font-medium text-primary">Continue</Link></>)}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto size-10 text-danger" />
            <p className="text-sm text-muted">{message}</p>
            {user ? <ResendVerification /> : <Link to="/login" className="font-medium text-primary">Sign in to request a new link</Link>}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
