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

export interface DiffComparableRow {
  rowId: string;
  internalId?: string | null;
  partNumber?: string | null;
  revision?: string | null;
  description?: string | null;
  quantity?: number | null;
  supplier?: string | null;
  color?: string | null;
  units?: string | null;
  cost?: number | null;
  category?: string | null;
  parentPath?: string | null;
  position?: string | null;
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
}

export interface PersistedDiffRow extends ClassifiedDiffRow {
  rowId: string;
  sourceIndex: number;
  targetIndex: number;
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
    changedFields: string[];
  };
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
}
