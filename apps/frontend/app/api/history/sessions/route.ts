import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const query = request.nextUrl.searchParams.toString();

  try {
    const upstream = await fetch(`${apiBase}/api/history/sessions${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'HISTORY_UPSTREAM_INVALID',
        message: 'History service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'HISTORY_UPSTREAM_UNAVAILABLE',
        message: 'History service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
