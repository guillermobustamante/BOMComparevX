import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  context: { params: { historyId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';

  let body: { tagLabel?: string } = {};
  try {
    body = (await request.json()) as { tagLabel?: string };
  } catch {
    // ignore, validation handled by backend
  }

  try {
    const upstream = await fetch(
      `${apiBase}/api/history/sessions/${encodeURIComponent(context.params.historyId)}/tag`,
      {
        method: 'POST',
        headers: {
          ...(cookie ? { cookie } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        cache: 'no-store'
      }
    );
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'HISTORY_TAG_UPSTREAM_INVALID',
        message: 'History service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'HISTORY_TAG_UPSTREAM_UNAVAILABLE',
        message: 'History service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}

