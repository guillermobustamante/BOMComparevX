import { Injectable } from '@nestjs/common';

@Injectable()
export class DiffFeatureFlagService {
  isMatcherGraphEnabled(): boolean {
    return this.readFlag('MATCHER_GRAPH_V1', true);
  }

  isResultsTreeViewEnabled(): boolean {
    return this.readFlag('RESULTS_TREE_VIEW_V1', true);
  }

  isResultsDynamicFiltersEnabled(): boolean {
    return this.readFlag('RESULTS_DYNAMIC_FILTERS_V1', true);
  }

  isProfileAdaptersEnabled(): boolean {
    return this.readFlag('MATCHER_PROFILE_ADAPTERS_V1', true);
  }

  isCompositeKeyEnabled(): boolean {
    return this.readFlag('MATCHER_COMPOSITE_KEY_V1', true);
  }

  isAmbiguityStrictEnabled(): boolean {
    return this.readFlag('MATCHER_AMBIGUITY_STRICT_V1', true);
  }

  isObsS7TreeExpandP95Enabled(): boolean {
    return this.readFlag('OBS_S7_TREE_EXPAND_P95', false);
  }

  isObsS7DynamicQueryP95Enabled(): boolean {
    return this.readFlag('OBS_S7_DYNAMIC_QUERY_P95', false);
  }

  isObsS7FirstHierarchyResponseEnabled(): boolean {
    return this.readFlag('OBS_S7_FIRST_HIERARCHY_RESPONSE', false);
  }

  isObsS7FirstMeaningfulTreeRowsEnabled(): boolean {
    return this.readFlag('OBS_S7_FIRST_MEANINGFUL_TREE_ROWS', false);
  }

  isObsS7OverheadVsS4Enabled(): boolean {
    return this.readFlag('OBS_S7_OVERHEAD_VS_S4', false);
  }

  private readFlag(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (!raw || !raw.trim()) {
      return defaultValue;
    }
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
}
