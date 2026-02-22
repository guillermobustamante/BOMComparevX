import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { comparisonId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const comparisonId = params.comparisonId;

  try {
    const upstream = await fetch(`${apiBase}/api/exports/csv/${encodeURIComponent(comparisonId)}`, {
      method: 'GET',
      headers: {
        ...(cookie ? { cookie } : {})
      },
      cache: 'no-store'
    });

    if (!upstream.ok) {
      let payload: unknown;
      try {
        payload = await upstream.json();
      } catch {
        payload = {
          code: 'EXPORT_CSV_UPSTREAM_INVALID',
          message: 'Export service returned an invalid response.',
          correlationId: randomUUID()
        };
      }
      return NextResponse.json(payload, { status: upstream.status });
    }

    const content = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'text/csv; charset=utf-8';
    const disposition =
      upstream.headers.get('content-disposition') || `attachment; filename="bomcompare_${comparisonId}_results.csv"`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return NextResponse.json(
      {
        code: 'EXPORT_CSV_UPSTREAM_UNAVAILABLE',
        message: 'Export service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
