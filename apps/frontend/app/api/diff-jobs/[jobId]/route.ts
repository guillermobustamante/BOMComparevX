import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const jobId = params.jobId;

  try {
    const upstream = await fetch(`${apiBase}/api/diff-jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store'
    });

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'DIFF_STATUS_UPSTREAM_INVALID',
        message: 'Diff status service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'DIFF_STATUS_UPSTREAM_UNAVAILABLE',
        message: 'Diff status service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
