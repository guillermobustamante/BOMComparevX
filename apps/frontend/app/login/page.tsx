interface LoginPageProps {
  searchParams?: {
    returnTo?: string;
  };
}

function sanitizeReturnTo(value: string | undefined): string {
  if (!value) return '/upload';
  if (!value.startsWith('/')) return '/upload';
  if (value.startsWith('//')) return '/upload';
  if (value.includes('\\')) return '/upload';
  return value;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const returnTo = sanitizeReturnTo(searchParams?.returnTo);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  return (
    <div className="page" style={{ padding: '24px' }}>
      <section className="panel" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <h1 className="h1">Sign in</h1>
        <p className="p">Choose a provider to continue to BOM Compare.</p>
        <div className="actions">
          <a className="btn btnPrimary" href={`${apiBase}/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}>
            Continue with Google
          </a>
          <a className="btn" href={`${apiBase}/api/auth/microsoft/start?returnTo=${encodeURIComponent(returnTo)}`}>
            Continue with Microsoft
          </a>
        </div>
      </section>
    </div>
  );
}
