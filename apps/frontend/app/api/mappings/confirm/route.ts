import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

interface ConfirmPayload {
  contractVersion: string;
  revisionId: string;
  explicitWarningAcknowledged: boolean;
  confirmationMode?: 'accepted_as_suggested' | 'accepted_with_overrides' | 'accepted_with_warnings';
  acceptedAsSuggested?: boolean;
  impactCoverageAcknowledged?: boolean;
  learnedAliasSuggestions?: Array<{
    sourceColumn: string;
    canonicalField: string;
    suggestedAlias: string;
  }>;
  mappings: Array<{
    sourceColumn: string;
    canonicalField: string;
    originalCanonicalField?: string | null;
    strategy?: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL' | 'TENANT_PACK';
    confidence?: number;
    reviewState: 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';
  }>;
}

export async function POST(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const cookie = request.headers.get('cookie') || '';
  let payload: ConfirmPayload;
  try {
    payload = (await request.json()) as ConfirmPayload;
  } catch {
    return NextResponse.json(
      {
        code: 'MAPPING_CONFIRM_INVALID_JSON',
        message: 'Mapping confirm payload must be valid JSON.',
        correlationId: randomUUID()
      },
      { status: 400 }
    );
  }

  if (!payload?.revisionId || !Array.isArray(payload.mappings) || payload.mappings.length === 0) {
    return NextResponse.json(
      {
        code: 'MAPPING_CONFIRM_INVALID_PAYLOAD',
        message: 'revisionId and mappings[] are required.',
        correlationId: randomUUID()
      },
      { status: 400 }
    );
  }

  const hasLowConfidence = payload.mappings.some(
    (mapping) => mapping.reviewState === 'LOW_CONFIDENCE_WARNING'
  );
  if (hasLowConfidence && payload.explicitWarningAcknowledged !== true) {
    return NextResponse.json(
      {
        code: 'MAPPING_CONFIRM_WARNING_ACK_REQUIRED',
        message: 'Low-confidence mappings require explicit warning acknowledgment.',
        correlationId: randomUUID()
      },
      { status: 400 }
    );
  }

  const deterministicMappings = [...payload.mappings]
    .sort((a, b) => a.sourceColumn.localeCompare(b.sourceColumn))
    .map((mapping) => ({
      sourceColumn: mapping.sourceColumn,
      canonicalField: mapping.canonicalField,
      originalCanonicalField: mapping.originalCanonicalField || null,
      strategy: mapping.strategy,
      confidence: mapping.confidence,
      reviewState: mapping.reviewState
    }));

  try {
    const upstream = await fetch(`${apiBase}/api/mappings/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {})
      },
      body: JSON.stringify({
        contractVersion: payload.contractVersion || 'v2',
        revisionId: payload.revisionId,
        explicitWarningAcknowledged: !!payload.explicitWarningAcknowledged,
        confirmationMode: payload.confirmationMode,
        acceptedAsSuggested: payload.acceptedAsSuggested,
        impactCoverageAcknowledged: payload.impactCoverageAcknowledged,
        learnedAliasSuggestions: payload.learnedAliasSuggestions || [],
        mappings: deterministicMappings
      }),
      cache: 'no-store'
    });
    let upstreamPayload: unknown;
    try {
      upstreamPayload = await upstream.json();
    } catch {
      upstreamPayload = {
        code: 'MAPPING_CONFIRM_UPSTREAM_INVALID',
        message: 'Mapping confirm service returned an invalid response.',
        correlationId: randomUUID()
      };
    }
    return NextResponse.json(upstreamPayload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: 'MAPPING_CONFIRM_UPSTREAM_UNAVAILABLE',
        message: 'Mapping confirm service is unavailable.',
        correlationId: randomUUID()
      },
      { status: 502 }
    );
  }
}
