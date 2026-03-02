import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  const jobId = params.jobId;
  const query = new URLSearchParams();

  const cursor = request.nextUrl.searchParams.get('cursor');
  const limit = request.nextUrl.searchParams.get('limit') || '50';
  const expandedNodeIds = request.nextUrl.searchParams.get('expandedNodeIds');
  const searchText = request.nextUrl.searchParams.get('searchText');
  const sortBy = request.nextUrl.searchParams.get('sortBy');
  const sortDir = request.nextUrl.searchParams.get('sortDir');
  const filters = request.nextUrl.searchParams.get('filters');

  if (cursor) query.set('cursor', cursor);
  query.set('limit', limit);
  if (expandedNodeIds) query.set('expandedNodeIds', expandedNodeIds);
  if (searchText) query.set('searchText', searchText);
  if (sortBy) query.set('sortBy', sortBy);
  if (sortDir) query.set('sortDir', sortDir);
  if (filters) query.set('filters', filters);

  try {
    const upstream = await fetch(
      `${apiBase}/api/diff-jobs/${encodeURIComponent(jobId)}/tree?${query.toString()}`,
      {
        method: 'GET',
        headers: cookie ? { cookie } : undefined,
        cache: 'no-store'
      }
    );

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = {
        code: 'DIFF_TREE_UPSTREAM_INVALID',
        message: 'Diff tree service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'DIFF_TREE_UPSTREAM_UNAVAILABLE',
        message: 'Diff tree service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
