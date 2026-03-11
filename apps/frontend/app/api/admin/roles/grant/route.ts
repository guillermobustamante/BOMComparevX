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
    const upstream = await fetch(`${apiBase}/api/admin/roles/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {})
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_ROLE_GRANT_UPSTREAM_UNAVAILABLE',
        message: 'Admin role grant service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
