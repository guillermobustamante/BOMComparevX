import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const query = request.nextUrl.search;

  try {
    const upstream = await fetch(`${apiBase}/api/admin/audit/export${query}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment; filename="audit.csv"',
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_AUDIT_EXPORT_UPSTREAM_UNAVAILABLE',
        message: 'Audit export service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
