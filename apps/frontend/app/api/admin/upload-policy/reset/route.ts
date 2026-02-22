import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const upstream = await fetch(`${apiBase}/api/admin/upload-policy/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {})
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    let upstreamPayload: unknown;
    try {
      upstreamPayload = await upstream.json();
    } catch {
      upstreamPayload = {
        code: 'ADMIN_POLICY_RESET_UPSTREAM_INVALID',
        message: 'Admin policy reset service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(upstreamPayload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_POLICY_RESET_UPSTREAM_UNAVAILABLE',
        message: 'Admin policy reset service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
