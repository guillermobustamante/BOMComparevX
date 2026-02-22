import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';

  try {
    const upstream = await fetch(`${apiBase}/api/admin/me`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'ADMIN_ME_UPSTREAM_INVALID',
        message: 'Admin service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_ME_UPSTREAM_UNAVAILABLE',
        message: 'Admin service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
