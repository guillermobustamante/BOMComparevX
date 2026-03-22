import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const formData = await request.formData();

  try {
    const upstream = await fetch(`${apiBase}/api/uploads/workbook-metadata`, {
      method: 'POST',
      headers: cookie ? { cookie } : undefined,
      body: formData,
      cache: 'no-store'
    });

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'UPLOAD_WORKBOOK_METADATA_UPSTREAM_INVALID',
        message: 'Workbook metadata service returned an invalid response.',
        correlationId: randomUUID()
      };
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'UPLOAD_WORKBOOK_METADATA_UPSTREAM_UNAVAILABLE',
        message: 'Workbook metadata service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
