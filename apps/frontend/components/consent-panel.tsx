'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function ConsentPanel(props: {
  termsVersion: string;
  privacyVersion: string;
  termsUrl: string;
  privacyUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  const onAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/consent/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok) {
        setError(`${payload.code || 'CONSENT_ACCEPT_FAILED'}: ${payload.message || 'Consent update failed.'}`);
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError('CONSENT_ACCEPT_FAILED: Consent update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel" style={{ maxWidth: '760px', margin: '24px auto' }} data-testid="consent-panel">
      <h1 className="h1">Terms and Privacy Consent</h1>
      <p className="p">
        You must accept the current policy versions to continue.
      </p>
      <div className="card" style={{ marginBottom: '12px' }}>
        <div><strong>Terms Version:</strong> {props.termsVersion}</div>
        <div><strong>Privacy Version:</strong> {props.privacyVersion}</div>
      </div>
      <div className="actions">
        <a className="btn" href={props.termsUrl} target="_blank" rel="noreferrer">
          View Terms
        </a>
        <a className="btn" href={props.privacyUrl} target="_blank" rel="noreferrer">
          View Privacy
        </a>
        <button
          className="btn btnPrimary"
          type="button"
          onClick={onAccept}
          disabled={submitting}
          data-testid="consent-accept-btn"
        >
          {submitting ? 'Saving...' : 'Accept and Continue'}
        </button>
      </div>
      {error && (
        <div className="alertError" data-testid="consent-error" style={{ marginTop: '12px' }}>
          {error}
        </div>
      )}
    </section>
  );
}

function sanitizeReturnTo(value: string | null): string {
  if (!value) return '/upload';
  if (!value.startsWith('/')) return '/upload';
  if (value.startsWith('//')) return '/upload';
  if (value.includes('\\')) return '/upload';
  return value;
}

