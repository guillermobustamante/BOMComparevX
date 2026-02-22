import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { comparisonId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const comparisonId = params.comparisonId;

  try {
    const upstream = await fetch(`${apiBase}/api/shares/${encodeURIComponent(comparisonId)}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'SHARE_LIST_UPSTREAM_INVALID',
        message: 'Share list service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'SHARE_LIST_UPSTREAM_UNAVAILABLE',
        message: 'Share list service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
