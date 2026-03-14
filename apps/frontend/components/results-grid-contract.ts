export type ChangeType =
  | 'added'
  | 'removed'
  | 'replaced'
  | 'modified'
  | 'moved'
  | 'quantity_change'
  | 'no_change';

export type ImpactCriticality = 'High' | 'Medium' | 'Low';

export interface DiffImpactCategory {
  industry: string;
  category: string;
  changeDescription: string;
  impactClass: string;
  impactCriticality: ImpactCriticality;
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
  impactCriticality: ImpactCriticality | null;
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  complianceTriggers: string[];
}

export interface DiffRow {
  rowId: string;
  changeType: ChangeType;
  sourceIndex: number;
  targetIndex: number;
  keyFields: {
    partNumber: string | null;
    revision: string | null;
    description: string | null;
  };
  cells: Array<{
    field: string;
    before: string | number | null;
    after: string | number | null;
    reasonCode: string;
  }>;
  rationale: {
    classificationReason: string;
    matchReason?: string;
    tieBreakTrace?: string[];
    score?: number;
    reviewRequired?: boolean;
    changedFields: string[];
  };
  impactClassification?: DiffImpactClassification | null;
}
