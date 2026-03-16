import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getSessionUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login?returnTo=/upload');
  }

  if (sessionUser.consentTrackingEnabled && sessionUser.consentRequired) {
    redirect('/consent?returnTo=/upload');
  }

  return (
    <AppShell userEmail={sessionUser.email} tenantId={sessionUser.tenantId}>
      {children}
    </AppShell>
  );
}
