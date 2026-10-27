import { useState } from 'react';
import { authApi } from '@/services/auth';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/feedback/states';

export function ResendVerification({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<{ pending: boolean; notice?: string; error?: string; sent?: boolean }>({ pending: false });
  return (
    <div className="space-y-2">
      <Button
        variant={compact ? 'link' : 'secondary'}
        size="sm"
        loading={state.pending}
        onClick={async () => {
          setState({ pending: true });
          try {
            const r = await authApi.resendVerification();
            setState({ pending: false, sent: r.emailSent, notice: r.alreadyVerified ? 'Your email is already verified.' : r.emailNotice });
          } catch (err) {
            setState({ pending: false, error: errorMessage(err) });
          }
        }}
      >
        Resend verification email
      </Button>
      {state.sent && <p className="text-[12px] text-success">Sent. Check your inbox.</p>}
      {state.notice && <Notice tone="warning">{state.notice}</Notice>}
      {state.error && <p className="text-[12px] text-danger">{state.error}</p>}
    </div>
  );
}
