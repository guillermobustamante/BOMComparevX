export const MAPPING_CONTRACT_VERSION = 'v1';

export const CONFIDENCE_BANDS = {
  autoMapMin: 0.9,
  reviewRequiredMin: 0.7
} as const;

export type MappingReviewState = 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';

export const REQUIRED_CANONICAL_FIELDS = ['part_number', 'description', 'quantity'] as const;
export const CONDITIONAL_CANONICAL_FIELDS = ['revision'] as const;
export const OPTIONAL_CANONICAL_FIELDS = ['supplier', 'cost', 'lifecycle_status'] as const;

export type CanonicalField =
  | (typeof REQUIRED_CANONICAL_FIELDS)[number]
  | (typeof CONDITIONAL_CANONICAL_FIELDS)[number]
  | (typeof OPTIONAL_CANONICAL_FIELDS)[number]
  | string;

export const DETECTION_CONFLICT_POLICY = 'fresh_detection_precedence';
export const MAPPING_EDIT_POLICY = 'owner_only';

export interface DetectedColumnCandidate {
  sourceColumn: string;
  canonicalField: CanonicalField | null;
  strategy: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL';
  confidence: number;
  reviewState: MappingReviewState;
  evidence?: {
    matchedAlias?: string;
    language?: string;
    domain?: string;
  };
}

export interface MappingPreviewContract {
  contractVersion: string;
  revisionId: string;
  columns: DetectedColumnCandidate[];
  sampleRows: Array<Record<string, string | number | null>>;
  requiredFieldsStatus: {
    field: CanonicalField;
    mapped: boolean;
    warning: boolean;
  }[];
  canProceed: boolean;
}

export interface MappingConfirmationContract {
  contractVersion: string;
  revisionId: string;
  actor: string;
  explicitWarningAcknowledged: boolean;
  mappings: Array<{
    sourceColumn: string;
    canonicalField: CanonicalField;
    languageMetadata?: string;
  }>;
}

export function resolveReviewState(confidence: number): MappingReviewState {
  if (confidence >= CONFIDENCE_BANDS.autoMapMin) return 'AUTO';
  if (confidence >= CONFIDENCE_BANDS.reviewRequiredMin) return 'REVIEW_REQUIRED';
  return 'LOW_CONFIDENCE_WARNING';
}

export function isRequiredFieldMapped(
  candidates: Array<Pick<DetectedColumnCandidate, 'canonicalField' | 'reviewState'>>,
  requiredField: CanonicalField
): { mapped: boolean; warning: boolean } {
  const match = candidates.find((candidate) => candidate.canonicalField === requiredField);
  if (!match) return { mapped: false, warning: true };
  return {
    mapped: true,
    warning: match.reviewState === 'LOW_CONFIDENCE_WARNING'
  };
}
