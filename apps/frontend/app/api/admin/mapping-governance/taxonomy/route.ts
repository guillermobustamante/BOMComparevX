import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const query = request.nextUrl.search;

  try {
    const upstream = await fetch(`${apiBase}/api/admin/mapping-governance/taxonomy${query}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'ADMIN_MAPPING_GOVERNANCE_TAXONOMY_UPSTREAM_UNAVAILABLE',
        message: 'Mapping governance taxonomy service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}

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
    const upstream = await fetch(`${apiBase}/api/admin/mapping-governance/taxonomy`, {
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
        code: 'ADMIN_MAPPING_GOVERNANCE_TAXONOMY_SAVE_UPSTREAM_UNAVAILABLE',
        message: 'Mapping governance taxonomy update service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
