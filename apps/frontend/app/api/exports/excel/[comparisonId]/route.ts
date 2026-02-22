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
    const upstream = await fetch(`${apiBase}/api/exports/excel/${encodeURIComponent(comparisonId)}`, {
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
          code: 'EXPORT_EXCEL_UPSTREAM_INVALID',
          message: 'Export service returned an invalid response.',
          correlationId: randomUUID()
        };
      }
      return NextResponse.json(payload, { status: upstream.status });
    }

    const binary = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get('content-type') ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const disposition =
      upstream.headers.get('content-disposition') || `attachment; filename="bomcompare_${comparisonId}_results.xlsx"`;

    return new NextResponse(binary, {
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
        code: 'EXPORT_EXCEL_UPSTREAM_UNAVAILABLE',
        message: 'Export service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
