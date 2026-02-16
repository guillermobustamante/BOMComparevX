import { cookies } from 'next/headers';

export interface SessionUser {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
  tenantId: string;
  correlationId: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const response = await fetch(`${apiBase}/api/auth/me`, {
    headers: {
      cookie: cookieHeader
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SessionUser;
}
