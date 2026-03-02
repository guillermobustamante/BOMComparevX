import { DiffComparableRow } from './diff-contract';

export type ProfileAdapterName = 'sap' | 'generic';

export type ProfileFieldClass = 'identity' | 'comparable' | 'display';

export interface ProfileFieldPolicy {
  identity: Array<keyof DiffComparableRow>;
  comparable: Array<keyof DiffComparableRow>;
  display: Array<keyof DiffComparableRow>;
}

export interface ProfileAdapterContext {
  fileName?: string;
  sheetName?: string;
  headers?: string[];
  headerFields?: Array<keyof DiffComparableRow | null>;
}

export interface ProfileAdapterResult {
  profileName: ProfileAdapterName;
  confidence: number;
  rows: DiffComparableRow[];
  fieldPolicy: ProfileFieldPolicy;
}
