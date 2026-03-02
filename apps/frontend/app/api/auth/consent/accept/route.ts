import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';

  try {
    const upstream = await fetch(`${apiBase}/api/auth/consent/accept`, {
      method: 'POST',
      headers: cookie
        ? {
            cookie
          }
        : undefined,
      cache: 'no-store'
    });
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'CONSENT_ACCEPT_UPSTREAM_INVALID',
        message: 'Consent service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'CONSENT_ACCEPT_UPSTREAM_UNAVAILABLE',
        message: 'Consent service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}

