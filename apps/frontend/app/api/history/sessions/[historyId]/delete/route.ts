import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  context: { params: { historyId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';

  try {
    const upstream = await fetch(
      `${apiBase}/api/history/sessions/${encodeURIComponent(context.params.historyId)}/delete`,
      {
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
        cache: 'no-store'
      }
    );
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'HISTORY_DELETE_UPSTREAM_INVALID',
        message: 'History service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'HISTORY_DELETE_UPSTREAM_UNAVAILABLE',
        message: 'History service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}

