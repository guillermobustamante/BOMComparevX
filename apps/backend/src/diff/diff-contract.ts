export const DIFF_CONTRACT_VERSION = 'v1';

export const MATCH_STRATEGY_ORDER = [
  'INTERNAL_ID',
  'PART_NUMBER_REVISION',
  'PART_NUMBER',
  'FUZZY',
  'NO_MATCH'
] as const;

export type MatchStrategy = (typeof MATCH_STRATEGY_ORDER)[number];

export const TIE_BREAK_ORDER = [
  'UNIQUENESS_FIRST',
  'HIGHEST_SCORE',
  'ATTRIBUTE_CONCORDANCE',
  'STABLE_FALLBACK_INDEX',
  'NEAR_TIE_REVIEW_REQUIRED'
] as const;

export type TieBreakStep = (typeof TIE_BREAK_ORDER)[number];

export const ATTRIBUTE_CONCORDANCE_ORDER = ['description', 'quantity', 'supplier'] as const;
export const NEAR_TIE_DELTA = 0.01;
export const MOVED_CONFIDENCE_THRESHOLD = 0.9;

export const CHANGE_TAXONOMY = [
  'added',
  'removed',
  'replaced',
  'modified',
  'moved',
  'quantity_change',
  'no_change'
] as const;

export type ChangeType = (typeof CHANGE_TAXONOMY)[number];
export type DiffPropertyValue = string | number | boolean | null;

export interface DiffImpactCategory {
  industry: string;
  category: string;
  changeDescription: string;
  impactClass: string;
  impactCriticality: 'High' | 'Medium' | 'Low';
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  controlPath: string;
  complianceTrigger: string;
  triggerProperties: string[];
  matchedProperties: string[];
}

export interface DiffImpactClassification {
  industry: string;
  categories: DiffImpactCategory[];
  highestImpactClass: string | null;
  impactCriticality: 'High' | 'Medium' | 'Low' | null;
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  complianceTriggers: string[];
}

export interface DiffComparableRow {
  rowId: string;
  internalId?: string | null;
  occurrenceInternalId?: string | null;
  objectInternalId?: string | null;
  stableOccurrenceKey?: string | null;
  snapshotRowKey?: string | null;
  profileName?: string | null;
  profileConfidence?: number | null;
  partNumber?: string | null;
  revision?: string | null;
  description?: string | null;
  quantity?: number | null;
  supplier?: string | null;
  plant?: string | null;
  color?: string | null;
  units?: string | null;
  cost?: number | null;
  category?: string | null;
  parentPath?: string | null;
  position?: string | null;
  assemblyPath?: string | null;
  findNumber?: string | null;
  hierarchyLevel?: number | null;
  properties?: Record<string, DiffPropertyValue>;
}

export interface MatchDecision {
  sourceRowId: string;
  targetRowId: string | null;
  strategy: MatchStrategy;
  score: number;
  reviewRequired: boolean;
  tieBreakTrace: TieBreakStep[];
  reasonCode: string;
}

export interface DiffCellChange {
  field: string;
  before: string | number | null;
  after: string | number | null;
  reasonCode: string;
}

export interface ClassifiedDiffRow {
  sourceRowId: string | null;
  targetRowId: string | null;
  changeType: ChangeType;
  reasonCode: string;
  matchedBy?: MatchStrategy;
  cells: DiffCellChange[];
  fromParent?: string | null;
  toParent?: string | null;
}

export interface PersistedDiffRow extends ClassifiedDiffRow {
  rowId: string;
  sourceIndex: number;
  targetIndex: number;
  sourceSnapshot?: DiffComparableRow | null;
  targetSnapshot?: DiffComparableRow | null;
  keyFields: {
    partNumber: string | null;
    revision: string | null;
    description: string | null;
  };
  rationale: {
    classificationReason: string;
    matchReason?: string;
    tieBreakTrace?: TieBreakStep[];
    score?: number;
    reviewRequired?: boolean;
    graphContextUsed?: boolean;
    sourceProfile?: string | null;
    targetProfile?: string | null;
    sourceStableOccurrenceKey?: string | null;
    targetStableOccurrenceKey?: string | null;
    changedFields: string[];
    fromParent?: string | null;
    toParent?: string | null;
  };
  impactClassification?: DiffImpactClassification | null;
}

export interface DiffJobCounters {
  total: number;
  added: number;
  removed: number;
  replaced: number;
  modified: number;
  moved: number;
  quantity_change: number;
  no_change: number;
}

export interface DiffJobStatusPayload {
  contractVersion: string;
  jobId: string;
  phase: 'matching' | 'classifying' | 'finalizing' | 'completed';
  percentComplete: number;
  counters: DiffJobCounters;
  loadedRows: number;
  totalRows: number;
  nextCursor: string | null;
  status: 'running' | 'completed';
  errorCode?: string;
  errorMessage?: string;
}

export interface PartNode {
  nodeId: string;
  tenantId: string;
  revisionId: string;
  sourceRowId: string;
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  internalId: string | null;
  createdAtUtc: string;
}

export interface ContainsEdge {
  edgeId: string;
  tenantId: string;
  revisionId: string;
  parentNodeId: string | null;
  childNodeId: string;
  sourceRowId: string;
  quantity: number | null;
  findNumber: string | null;
  parentPath: string | null;
  depth: number | null;
  createdAtUtc: string;
}

export interface RevisionGraphSnapshot {
  tenantId: string;
  revisionId: string;
  nodes: PartNode[];
  edges: ContainsEdge[];
  createdAtUtc: string;
}

export type DiffRowsQueryOperator = 'eq' | 'contains' | 'gt' | 'lt' | 'in';

export interface DiffRowsQueryFilter {
  field: string;
  op: DiffRowsQueryOperator;
  value: string;
}

export interface DiffRowsQueryDescriptor {
  searchText?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: DiffRowsQueryFilter[];
}

export interface DiffTreeNode {
  nodeId: string;
  parentNodeId: string | null;
  depth: number;
  hasChildren: boolean;
  rowId: string;
  changeType: ChangeType;
  keyFields: {
    partNumber: string | null;
    revision: string | null;
    description: string | null;
  };
  changedFields: string[];
  fromParent?: string | null;
  toParent?: string | null;
}

export interface DiffTreeResponse {
  contractVersion: string;
  jobId: string;
  nodes: DiffTreeNode[];
  nextCursor: string | null;
  hasMore: boolean;
  loadedRows: number;
  totalRows: number;
}
