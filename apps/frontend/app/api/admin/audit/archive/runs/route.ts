import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const query = request.nextUrl.search;

  try {
    const upstream = await fetch(`${apiBase}/api/admin/audit/archive/runs${query}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_AUDIT_ARCHIVE_RUNS_UPSTREAM_UNAVAILABLE',
        message: 'Audit archive history service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
