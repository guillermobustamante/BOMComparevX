import { Injectable } from '@nestjs/common';
import {
  DIFF_CONTRACT_VERSION,
  DiffComparableRow,
  DiffJobCounters,
  PersistedDiffRow
} from './diff-contract';
import { ClassificationService } from './classification.service';
import { DiffFeatureFlagService } from './feature-flag.service';
import { MatcherService } from './matcher.service';
import { NormalizationService } from './normalization.service';
import { ProfileAdapterContext, ProfileFieldPolicy } from './profile-adapter.contract';
import { ProfileAdapterService } from './profile-adapter.service';
import { BomChangeTaxonomyService } from '../mapping/bom-change-taxonomy.service';

const PROGRESS_BATCH_SIZE = 25;
const PHASE_PERCENT_RANGES = {
  matching: { start: 5, end: 54 },
  classifying: { start: 55, end: 84 },
  finalizing: { start: 85, end: 99 }
} as const;

export interface DiffComputationProgress {
  phase: 'matching' | 'classifying' | 'finalizing';
  percentComplete: number;
}

@Injectable()
export class DiffComputationService {
  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly featureFlags: DiffFeatureFlagService,
    private readonly profileAdapterService: ProfileAdapterService,
    private readonly matcherService: MatcherService,
    private readonly classificationService: ClassificationService,
    private readonly bomChangeTaxonomyService: BomChangeTaxonomyService
  ) {}

  compute(input: {
    sourceRows: DiffComparableRow[];
    targetRows: DiffComparableRow[];
    sourceContext?: ProfileAdapterContext;
    targetContext?: ProfileAdapterContext;
  }): {
    contractVersion: string;
    rows: PersistedDiffRow[];
    counters: DiffJobCounters;
    diagnostics: {
      sourceProfile: string;
      targetProfile: string;
      sourceKeyCollisionRate: number;
      targetKeyCollisionRate: number;
      ambiguityRate: number;
      unmatchedRate: number;
      replacementSuppressionRate: number;
      profileSelectionDistribution: Record<string, number>;
      flags: {
        profileAdaptersEnabled: boolean;
        compositeKeyEnabled: boolean;
        ambiguityStrictEnabled: boolean;
      };
    };
  } {
    const sourceNormalized = input.sourceRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const targetNormalized = input.targetRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const profileAdaptersEnabled = this.featureFlags.isProfileAdaptersEnabled();
    const compositeKeyEnabled = this.featureFlags.isCompositeKeyEnabled();
    const ambiguityStrictEnabled = this.featureFlags.isAmbiguityStrictEnabled();

    const sourceProfile = profileAdaptersEnabled
      ? this.profileAdapterService.adaptRows({
          rows: sourceNormalized,
          context: input.sourceContext
        })
      : {
          profileName: 'generic' as const,
          confidence: 0.5,
          rows: sourceNormalized,
          fieldPolicy: DEFAULT_GENERIC_POLICY
        };
    const targetProfile = profileAdaptersEnabled
      ? this.profileAdapterService.adaptRows({
          rows: targetNormalized,
          context: input.targetContext
        })
      : {
          profileName: 'generic' as const,
          confidence: 0.5,
          rows: targetNormalized,
          fieldPolicy: DEFAULT_GENERIC_POLICY
        };

    const source = compositeKeyEnabled
      ? sourceProfile.rows
      : sourceProfile.rows.map((row) => ({
          ...row,
          stableOccurrenceKey: null,
          snapshotRowKey: null
        }));
    const target = compositeKeyEnabled
      ? targetProfile.rows
      : targetProfile.rows.map((row) => ({
          ...row,
          stableOccurrenceKey: null,
          snapshotRowKey: null
        }));
    const sourceIndex = new Map(source.map((row, index) => [row.rowId, index]));
    const targetIndex = new Map(target.map((row, index) => [row.rowId, index]));
    const sourceById = new Map(source.map((row) => [row.rowId, row]));
    const targetById = new Map(target.map((row) => [row.rowId, row]));

    const matchResult = this.matcherService.match(source, target);
    const classification = this.classificationService.classifyWithStats({
      sourceRows: source,
      targetRows: target,
      matches: matchResult.matches,
      unmatchedSourceIds: matchResult.unmatchedSourceIds,
      unmatchedTargetIds: matchResult.unmatchedTargetIds,
      sourceFieldPolicy: sourceProfile.fieldPolicy,
      targetFieldPolicy: targetProfile.fieldPolicy
    });
    const classified = classification.rows;

    const matchBySource = new Map(matchResult.matches.map((match) => [match.sourceRowId, match]));

    const rows: PersistedDiffRow[] = classified.map((row) => {
      const sourceRow = row.sourceRowId ? sourceById.get(row.sourceRowId) || null : null;
      const targetRow = row.targetRowId ? targetById.get(row.targetRowId) || null : null;
      const keyRow = targetRow || sourceRow;
      const decision = row.sourceRowId ? matchBySource.get(row.sourceRowId) : undefined;

      const sourceRowIndex = row.sourceRowId ? sourceIndex.get(row.sourceRowId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const targetRowIndex = row.targetRowId ? targetIndex.get(row.targetRowId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const orderingSourceIndex = sourceRowIndex === Number.MAX_SAFE_INTEGER ? 1000000 + targetRowIndex : sourceRowIndex;

      return {
        ...row,
        rowId: `${row.sourceRowId || 'none'}::${row.targetRowId || 'none'}`,
        sourceIndex: orderingSourceIndex,
        targetIndex: targetRowIndex,
        sourceSnapshot: sourceRow,
        targetSnapshot: targetRow,
        keyFields: {
          partNumber: keyRow?.partNumber || null,
          revision: keyRow?.revision || null,
          description: keyRow?.description || null
        },
        rationale: {
          classificationReason: row.reasonCode,
          matchReason: decision?.reasonCode,
          tieBreakTrace: decision?.tieBreakTrace,
          score: decision?.score,
          reviewRequired: decision?.reviewRequired,
          graphContextUsed: decision?.reasonCode?.includes('graph_context') || false,
          sourceProfile: sourceRow?.profileName || null,
          targetProfile: targetRow?.profileName || null,
          sourceStableOccurrenceKey: sourceRow?.stableOccurrenceKey || null,
          targetStableOccurrenceKey: targetRow?.stableOccurrenceKey || null,
          changedFields: row.cells.map((cell) => cell.field),
          fromParent: row.fromParent ?? null,
          toParent: row.toParent ?? null
        }
      };
    });

    rows.sort(
      (a, b) =>
        a.sourceIndex - b.sourceIndex ||
        a.targetIndex - b.targetIndex ||
        a.rowId.localeCompare(b.rowId)
    );

    const counters = rows.reduce<DiffJobCounters>(
      (acc, row) => {
        acc.total += 1;
        acc[row.changeType] += 1;
        return acc;
      },
      {
        total: 0,
        added: 0,
        removed: 0,
        replaced: 0,
        modified: 0,
        moved: 0,
        quantity_change: 0,
        no_change: 0
      }
    );

    const ambiguousMatchCount = matchResult.matches.filter((match) => match.reviewRequired).length;
    const unmatchedRate = Number(
      (
        (matchResult.unmatchedSourceIds.length + matchResult.unmatchedTargetIds.length) /
        Math.max(1, source.length + target.length)
      ).toFixed(6)
    );
    const sourceKeyCollisionRate = this.keyCollisionRate(source);
    const targetKeyCollisionRate = this.keyCollisionRate(target);
    const replacementSuppressionRate = Number(
      (
        classification.stats.replacementSuppressed /
        Math.max(1, classification.stats.replacementCandidates)
      ).toFixed(6)
    );

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      rows,
      counters,
      diagnostics: {
        sourceProfile: sourceProfile.profileName,
        targetProfile: targetProfile.profileName,
        sourceKeyCollisionRate,
        targetKeyCollisionRate,
        ambiguityRate: Number((ambiguousMatchCount / Math.max(1, source.length)).toFixed(6)),
        unmatchedRate,
        replacementSuppressionRate,
        profileSelectionDistribution: {
          [`source:${sourceProfile.profileName}`]: source.length,
          [`target:${targetProfile.profileName}`]: target.length
        },
        flags: {
          profileAdaptersEnabled,
          compositeKeyEnabled,
          ambiguityStrictEnabled
        }
      }
    };
  }

  async computeAsync(input: {
    tenantId?: string;
    sourceRows: DiffComparableRow[];
    targetRows: DiffComparableRow[];
    sourceContext?: ProfileAdapterContext;
    targetContext?: ProfileAdapterContext;
    onProgress?: (progress: DiffComputationProgress) => Promise<void> | void;
  }): Promise<{
    contractVersion: string;
    rows: PersistedDiffRow[];
    counters: DiffJobCounters;
    diagnostics: {
      sourceProfile: string;
      targetProfile: string;
      sourceKeyCollisionRate: number;
      targetKeyCollisionRate: number;
      ambiguityRate: number;
      unmatchedRate: number;
      replacementSuppressionRate: number;
      profileSelectionDistribution: Record<string, number>;
      flags: {
        profileAdaptersEnabled: boolean;
        compositeKeyEnabled: boolean;
        ambiguityStrictEnabled: boolean;
      };
    };
  }> {
    const reportProgress = this.createProgressReporter(input.onProgress);
    const matchingTotalUnits = Math.max(1, input.sourceRows.length * 2 + input.targetRows.length);
    let matchingCompletedUnits = 0;
    const sourceNormalized: DiffComparableRow[] = [];
    const targetNormalized: DiffComparableRow[] = [];

    for (let index = 0; index < input.sourceRows.length; index += 1) {
      sourceNormalized.push(this.normalizationService.normalizeRow(input.sourceRows[index]).row);
      matchingCompletedUnits += 1;
      if ((index + 1) % PROGRESS_BATCH_SIZE === 0 || index === input.sourceRows.length - 1) {
        await reportProgress('matching', matchingCompletedUnits, matchingTotalUnits);
      }
    }

    for (let index = 0; index < input.targetRows.length; index += 1) {
      targetNormalized.push(this.normalizationService.normalizeRow(input.targetRows[index]).row);
      matchingCompletedUnits += 1;
      if ((index + 1) % PROGRESS_BATCH_SIZE === 0 || index === input.targetRows.length - 1) {
        await reportProgress('matching', matchingCompletedUnits, matchingTotalUnits);
      }
    }

    const profileAdaptersEnabled = this.featureFlags.isProfileAdaptersEnabled();
    const compositeKeyEnabled = this.featureFlags.isCompositeKeyEnabled();
    const ambiguityStrictEnabled = this.featureFlags.isAmbiguityStrictEnabled();

    const sourceProfile = profileAdaptersEnabled
      ? this.profileAdapterService.adaptRows({
          rows: sourceNormalized,
          context: input.sourceContext
        })
      : {
          profileName: 'generic' as const,
          confidence: 0.5,
          rows: sourceNormalized,
          fieldPolicy: DEFAULT_GENERIC_POLICY
        };
    const targetProfile = profileAdaptersEnabled
      ? this.profileAdapterService.adaptRows({
          rows: targetNormalized,
          context: input.targetContext
        })
      : {
          profileName: 'generic' as const,
          confidence: 0.5,
          rows: targetNormalized,
          fieldPolicy: DEFAULT_GENERIC_POLICY
        };

    const source = compositeKeyEnabled
      ? sourceProfile.rows
      : sourceProfile.rows.map((row) => ({
          ...row,
          stableOccurrenceKey: null,
          snapshotRowKey: null
        }));
    const target = compositeKeyEnabled
      ? targetProfile.rows
      : targetProfile.rows.map((row) => ({
          ...row,
          stableOccurrenceKey: null,
          snapshotRowKey: null
        }));
    const sourceIndex = new Map(source.map((row, index) => [row.rowId, index]));
    const targetIndex = new Map(target.map((row, index) => [row.rowId, index]));
    const sourceById = new Map(source.map((row) => [row.rowId, row]));
    const targetById = new Map(target.map((row) => [row.rowId, row]));

    const matchResult = await this.matcherService.matchAsync(source, target, async (completed, total) => {
      const safeTotal = Math.max(1, total);
      matchingCompletedUnits = input.sourceRows.length + input.targetRows.length + Math.min(completed, safeTotal);
      await reportProgress('matching', matchingCompletedUnits, matchingTotalUnits);
    });
    const classification = await this.classificationService.classifyWithStatsAsync({
      sourceRows: source,
      targetRows: target,
      matches: matchResult.matches,
      unmatchedSourceIds: matchResult.unmatchedSourceIds,
      unmatchedTargetIds: matchResult.unmatchedTargetIds,
      sourceFieldPolicy: sourceProfile.fieldPolicy,
      targetFieldPolicy: targetProfile.fieldPolicy
    }, async (completed, total) => {
      await reportProgress('classifying', completed, total);
    });
    const classified = classification.rows;

    const matchBySource = new Map(matchResult.matches.map((match) => [match.sourceRowId, match]));

    const finalizationTotalUnits = Math.max(1, classified.length * 2 + 1);
    const rows: PersistedDiffRow[] = [];

    for (let index = 0; index < classified.length; index += 1) {
      const row = classified[index];
      const sourceRow = row.sourceRowId ? sourceById.get(row.sourceRowId) || null : null;
      const targetRow = row.targetRowId ? targetById.get(row.targetRowId) || null : null;
      const keyRow = targetRow || sourceRow;
      const decision = row.sourceRowId ? matchBySource.get(row.sourceRowId) : undefined;

      const sourceRowIndex = row.sourceRowId ? sourceIndex.get(row.sourceRowId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const targetRowIndex = row.targetRowId ? targetIndex.get(row.targetRowId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const orderingSourceIndex = sourceRowIndex === Number.MAX_SAFE_INTEGER ? 1000000 + targetRowIndex : sourceRowIndex;

      rows.push({
        ...row,
        rowId: `${row.sourceRowId || 'none'}::${row.targetRowId || 'none'}`,
        sourceIndex: orderingSourceIndex,
        targetIndex: targetRowIndex,
        sourceSnapshot: sourceRow,
        targetSnapshot: targetRow,
        keyFields: {
          partNumber: keyRow?.partNumber || null,
          revision: keyRow?.revision || null,
          description: keyRow?.description || null
        },
        rationale: {
          classificationReason: row.reasonCode,
          matchReason: decision?.reasonCode,
          tieBreakTrace: decision?.tieBreakTrace,
          score: decision?.score,
          reviewRequired: decision?.reviewRequired,
          graphContextUsed: decision?.reasonCode?.includes('graph_context') || false,
          sourceProfile: sourceRow?.profileName || null,
          targetProfile: targetRow?.profileName || null,
          sourceStableOccurrenceKey: sourceRow?.stableOccurrenceKey || null,
          targetStableOccurrenceKey: targetRow?.stableOccurrenceKey || null,
          changedFields: row.cells.map((cell) => cell.field),
          fromParent: row.fromParent ?? null,
          toParent: row.toParent ?? null
        }
      });

      if ((index + 1) % PROGRESS_BATCH_SIZE === 0 || index === classified.length - 1) {
        await reportProgress('finalizing', index + 1, finalizationTotalUnits);
      }
    }

    rows.sort(
      (a, b) =>
        a.sourceIndex - b.sourceIndex ||
        a.targetIndex - b.targetIndex ||
        a.rowId.localeCompare(b.rowId)
    );

    await reportProgress('finalizing', classified.length + 1, finalizationTotalUnits);

    const counters: DiffJobCounters = {
      total: 0,
      added: 0,
      removed: 0,
      replaced: 0,
      modified: 0,
      moved: 0,
      quantity_change: 0,
      no_change: 0
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      counters.total += 1;
      counters[row.changeType] += 1;
      if ((index + 1) % PROGRESS_BATCH_SIZE === 0 || index === rows.length - 1) {
        await reportProgress('finalizing', classified.length + 1 + index + 1, finalizationTotalUnits);
      }
    }

    const tenantId = input.tenantId;
    if (tenantId) {
      await Promise.all(
        rows.map(async (row) => {
          if (!['modified', 'quantity_change', 'moved', 'replaced', 'no_change'].includes(row.changeType)) {
            row.impactClassification = null;
            return;
          }
          const changedProperties = row.cells.map((cell) => cell.field);
          if (changedProperties.length === 0) {
            row.impactClassification = null;
            return;
          }
          const classifiedImpact = await this.bomChangeTaxonomyService.classifyChangedProperties(
            tenantId,
            changedProperties
          );
          row.impactClassification = {
            industry: classifiedImpact.industry,
            categories: classifiedImpact.categories.map((category) => ({
              industry: category.industry,
              category: category.category,
              changeDescription: category.changeDescription,
              impactClass: category.impactClass,
              impactCriticality: category.impactCriticality,
              internalApprovingRoles: category.internalApprovingRoles,
              externalApprovingRoles: category.externalApprovingRoles,
              controlPath: category.controlPath,
              complianceTrigger: category.complianceTrigger,
              triggerProperties: category.triggerProperties,
              matchedProperties: category.matchedProperties
            })),
            highestImpactClass: classifiedImpact.highestImpactClass,
            impactCriticality: classifiedImpact.impactCriticality,
            internalApprovingRoles: classifiedImpact.internalApprovingRoles,
            externalApprovingRoles: classifiedImpact.externalApprovingRoles,
            complianceTriggers: classifiedImpact.complianceTriggers
          };
        })
      );
    }

    const ambiguousMatchCount = matchResult.matches.filter((match) => match.reviewRequired).length;
    const unmatchedRate = Number(
      (
        (matchResult.unmatchedSourceIds.length + matchResult.unmatchedTargetIds.length) /
        Math.max(1, source.length + target.length)
      ).toFixed(6)
    );
    const sourceKeyCollisionRate = this.keyCollisionRate(source);
    const targetKeyCollisionRate = this.keyCollisionRate(target);
    const replacementSuppressionRate = Number(
      (
        classification.stats.replacementSuppressed /
        Math.max(1, classification.stats.replacementCandidates)
      ).toFixed(6)
    );

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      rows,
      counters,
      diagnostics: {
        sourceProfile: sourceProfile.profileName,
        targetProfile: targetProfile.profileName,
        sourceKeyCollisionRate,
        targetKeyCollisionRate,
        ambiguityRate: Number((ambiguousMatchCount / Math.max(1, source.length)).toFixed(6)),
        unmatchedRate,
        replacementSuppressionRate,
        profileSelectionDistribution: {
          [`source:${sourceProfile.profileName}`]: source.length,
          [`target:${targetProfile.profileName}`]: target.length
        },
        flags: {
          profileAdaptersEnabled,
          compositeKeyEnabled,
          ambiguityStrictEnabled
        }
      }
    };
  }

  private createProgressReporter(
    onProgress?: (progress: DiffComputationProgress) => Promise<void> | void
  ): (
    phase: DiffComputationProgress['phase'],
    completedUnits: number,
    totalUnits: number
  ) => Promise<void> {
    let lastPhase: DiffComputationProgress['phase'] | null = null;
    let lastPercentComplete = -1;

    return async (
      phase: DiffComputationProgress['phase'],
      completedUnits: number,
      totalUnits: number
    ): Promise<void> => {
      if (!onProgress) return;

      const percentComplete = this.scalePhasePercent(phase, completedUnits, totalUnits);
      if (lastPhase === phase && lastPercentComplete === percentComplete) {
        return;
      }

      lastPhase = phase;
      lastPercentComplete = percentComplete;
      await onProgress({
        phase,
        percentComplete
      });
    };
  }

  private scalePhasePercent(
    phase: DiffComputationProgress['phase'],
    completedUnits: number,
    totalUnits: number
  ): number {
    const range = PHASE_PERCENT_RANGES[phase];
    const safeTotal = Math.max(1, totalUnits);
    const boundedCompleted = Math.max(0, Math.min(completedUnits, safeTotal));
    const ratio = boundedCompleted / safeTotal;
    return Math.max(range.start, Math.min(range.end, Math.round(range.start + (range.end - range.start) * ratio)));
  }

  private keyCollisionRate(rows: DiffComparableRow[]): number {
    const keys = rows.map((row) => row.stableOccurrenceKey).filter((key): key is string => !!key);
    if (!keys.length) return 0;
    const counts = new Map<string, number>();
    for (const key of keys) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let duplicateRows = 0;
    for (const count of counts.values()) {
      if (count > 1) {
        duplicateRows += count - 1;
      }
    }
    return Number((duplicateRows / keys.length).toFixed(6));
  }
}

const DEFAULT_GENERIC_POLICY: ProfileFieldPolicy = {
  identity: ['internalId'],
  comparable: ['partNumber', 'revision', 'description', 'quantity', 'supplier', 'plant', 'cost', 'color', 'units'],
  display: ['parentPath', 'position', 'assemblyPath', 'findNumber', 'hierarchyLevel'],
  businessImpact: ['supplier', 'plant', 'cost', 'quantity']
};
