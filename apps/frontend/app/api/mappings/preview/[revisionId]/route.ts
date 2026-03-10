import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { revisionId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const revisionId = params.revisionId;
  const profile = request.nextUrl.searchParams.get('profile');
  const upstreamUrl = new URL(`${apiBase}/api/mappings/preview/${encodeURIComponent(revisionId)}`);
  if (profile) {
    upstreamUrl.searchParams.set('profile', profile);
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'MAPPING_PREVIEW_UPSTREAM_INVALID',
        message: 'Mapping preview service returned an invalid response.',
        correlationId: randomUUID()
      };
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'MAPPING_PREVIEW_UPSTREAM_UNAVAILABLE',
        message: 'Mapping preview service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
