export const MAPPING_CONTRACT_VERSION = 'v2';

export const CONFIDENCE_BANDS = {
  autoMapMin: 0.9,
  reviewRequiredMin: 0.7
} as const;

export type MappingReviewState = 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';
export type MappingFieldClass = 'identity' | 'comparable' | 'display' | 'business_impact';
export type MappingPreviewGroupId =
  | 'required_compare'
  | 'recommended_matching'
  | 'impact_classification'
  | 'preserved_unclassified';
export type MappingConsequenceLevel = 'critical' | 'important' | 'helpful' | 'informational';
export type MappingComparisonReadiness = 'ready' | 'warning' | 'blocked';
export type MappingImpactReadiness = 'strong' | 'partial' | 'weak';
export type MappingConfirmationMode =
  | 'accepted_as_suggested'
  | 'accepted_with_overrides'
  | 'accepted_with_warnings';

export const REQUIRED_CANONICAL_FIELDS = ['part_number', 'description', 'quantity'] as const;
export const CONDITIONAL_CANONICAL_FIELDS = ['revision'] as const;
export const OPTIONAL_CANONICAL_FIELDS = ['supplier', 'cost', 'lifecycle_status'] as const;
export const EXTENDED_CANONICAL_FIELDS = [
  'occurrence_id',
  'object_id',
  'unit_of_measure',
  'find_number',
  'assembly',
  'parent_path',
  'plant',
  'make_buy',
  'material',
  'finish',
  'weight',
  'effectivity',
  'effectivity_from',
  'effectivity_to',
  'serial_range',
  'drawing_number',
  'manufacturer_part_number',
  'customer_part_number',
  'compliance_status',
  'hazard_class',
  'location',
  'discipline',
  'work_center',
  'procurement_type',
  'lead_time',
  'material_group',
  'routing_ref',
  'alternate_part',
  'program',
  'vehicle_line',
  'option_code',
  'engineering_level',
  'change_notice',
  'supplier_code',
  'ppap_status',
  'tooling_status',
  'service_part_flag',
  'dash_number',
  'tail_number',
  'lot',
  'configuration_state',
  'criticality',
  'airworthiness_class',
  'approved_supplier',
  'reference_designator',
  'footprint',
  'package',
  'manufacturer',
  'avl',
  'rohs',
  'reach',
  'lifecycle_risk',
  'substitute_part',
  'asset_id',
  'system',
  'spec_section',
  'level',
  'zone',
  'room',
  'ifc_class',
  'cobie_attribute',
  'install_phase',
  'revision_package'
] as const;

export const ALL_CANONICAL_FIELDS = [
  ...REQUIRED_CANONICAL_FIELDS,
  ...CONDITIONAL_CANONICAL_FIELDS,
  ...OPTIONAL_CANONICAL_FIELDS,
  ...EXTENDED_CANONICAL_FIELDS
] as const;

export const MAPPING_PROFILE_TYPES = [
  'electronics',
  'mechanical',
  'aerospace',
  'manufacturing',
  'automotive',
  'construction',
  'plm_generic',
  'erp_generic',
  'sap_bom',
  'teamcenter_bom',
  'ifc_schedule',
  'ipc_bom'
] as const;

export type MappingProfile = (typeof MAPPING_PROFILE_TYPES)[number];

export type CanonicalField =
  | (typeof ALL_CANONICAL_FIELDS)[number]
  | string;

export const DETECTION_CONFLICT_POLICY = 'fresh_detection_precedence';
export const MAPPING_EDIT_POLICY = 'owner_only';

export interface DetectedColumnCandidate {
  sourceColumn: string;
  canonicalField: CanonicalField | null;
  strategy: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL' | 'TENANT_PACK';
  confidence: number;
  reviewState: MappingReviewState;
  fieldClass?: MappingFieldClass;
  evidence?: {
    matchedAlias?: string;
    language?: string;
    domain?: string;
    profile?: MappingProfile;
    reasons?: string[];
    negativeSignals?: string[];
  };
}

export interface MappingPreviewContract {
  contractVersion: string;
  revisionId: string;
  summary: {
    comparisonReadiness: MappingComparisonReadiness;
    impactReadiness: MappingImpactReadiness;
    unresolvedCount: number;
    lowConfidenceCriticalCount: number;
    canProceed: boolean;
    proceedLabel: string;
  };
  groups: Array<{
    id: MappingPreviewGroupId;
    label: string;
    description: string;
    counts: {
      total: number;
      unresolved: number;
      lowConfidence: number;
    };
  }>;
  columns: Array<
    DetectedColumnCandidate & {
      displayLabel: string;
      sampleValues: string[];
      canonicalFieldLabel: string | null;
      suggestedBusinessMeaning: string | null;
      fieldRoles: string[];
      groupId: MappingPreviewGroupId;
      consequenceLevel: MappingConsequenceLevel;
      whyItMatters: string;
      proceedImpact: string;
      semanticFamily: string | null;
      classificationTags: string[];
      likelyCategories: string[];
    }
  >;
  impactReadiness: {
    recognizedTriggerColumns: number;
    semanticallyUnclassifiedColumns: string[];
    likelyCoverageNotes: string[];
  };
  recommendedActions: string[];
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
  confirmationMode?: MappingConfirmationMode;
  acceptedAsSuggested?: boolean;
  impactCoverageAcknowledged?: boolean;
  learnedAliasSuggestions?: Array<{
    sourceColumn: string;
    canonicalField: CanonicalField;
    suggestedAlias: string;
  }>;
  mappings: Array<{
    sourceColumn: string;
    canonicalField: CanonicalField | null;
    originalCanonicalField?: CanonicalField | null;
    strategy?: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL';
    confidence?: number;
    reviewState?: MappingReviewState;
    languageMetadata?: string;
  }>;
}

export interface MappingSnapshotContract {
  contractVersion: string;
  mappingId: string;
  revisionId: string;
  tenantId: string;
  immutable: true;
  confirmedAtUtc: string;
  createdBy: string;
  originalColumns: string[];
  mappings: Array<{
    sourceColumn: string;
    canonicalField: CanonicalField | null;
    languageMetadata?: string;
    strategy?: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL';
    confidence?: number;
    reviewState?: MappingReviewState;
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
