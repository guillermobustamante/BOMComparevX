import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const notificationId = params.notificationId;

  try {
    const upstream = await fetch(
      `${apiBase}/api/notifications/${encodeURIComponent(notificationId)}/read`,
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
        code: 'NOTIFICATION_READ_UPSTREAM_INVALID',
        message: 'Notifications service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'NOTIFICATION_READ_UPSTREAM_UNAVAILABLE',
        message: 'Notifications service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
