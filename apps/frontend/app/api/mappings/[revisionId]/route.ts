import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { revisionId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const revisionId = context.params.revisionId;

  try {
    const upstream = await fetch(`${apiBase}/api/mappings/${encodeURIComponent(revisionId)}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'MAPPING_SNAPSHOT_UPSTREAM_UNAVAILABLE',
        message: 'Mapping snapshot detail service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
