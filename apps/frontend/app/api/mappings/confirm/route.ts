import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

interface ConfirmPayload {
  contractVersion: string;
  revisionId: string;
  explicitWarningAcknowledged: boolean;
  mappings: Array<{
    sourceColumn: string;
    canonicalField: string;
    reviewState: 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';
  }>;
}

export async function POST(request: NextRequest) {
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
      reviewState: mapping.reviewState
    }));

  return NextResponse.json(
    {
      status: 'accepted',
      revisionId: payload.revisionId,
      contractVersion: payload.contractVersion || 'v1',
      explicitWarningAcknowledged: !!payload.explicitWarningAcknowledged,
      mappings: deterministicMappings,
      correlationId: randomUUID()
    },
    { status: 202 }
  );
}
