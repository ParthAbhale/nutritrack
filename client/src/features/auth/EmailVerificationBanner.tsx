import { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { useCapabilities, useMe } from '@/services/auth';
import { ResendVerification } from './ResendVerification';

export function EmailVerificationBanner() {
  const { data: user } = useMe();
  const caps = useCapabilities();
  const [dismissed, setDismissed] = useState(false);
  if (!user || user.emailVerified || dismissed) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-warning-soft px-4 py-2 text-[13px] text-warning-ink sm:px-6">
      <MailWarning className="size-4 shrink-0" aria-hidden />
      <span>
        Please verify <strong>{user.email}</strong>.{' '}
        {caps.data && !caps.data.emailDelivery && 'Email delivery is not configured on this server, so verification emails cannot be delivered.'}
      </span>
      {caps.data?.emailDelivery && <ResendVerification compact />}
      <button type="button" className="ml-auto rounded p-1 hover:bg-black/5" aria-label="Dismiss" onClick={() => setDismissed(true)}>
        <X className="size-4" />
      </button>
    </div>
  );
}
