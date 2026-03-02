import { redirect } from 'next/navigation';
import { ConsentPanel } from '@/components/consent-panel';
import { getSessionUser } from '@/lib/session';

export default async function ConsentPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login?returnTo=/upload');
  }

  if (!sessionUser.consentTrackingEnabled || !sessionUser.consentRequired || !sessionUser.consent) {
    redirect('/upload');
  }

  return (
    <div className="page" style={{ padding: '24px' }}>
      <ConsentPanel
        termsVersion={sessionUser.consent.termsVersion}
        privacyVersion={sessionUser.consent.privacyVersion}
        termsUrl={sessionUser.consent.termsUrl}
        privacyUrl={sessionUser.consent.privacyUrl}
      />
    </div>
  );
}

