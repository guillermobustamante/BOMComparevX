import { Injectable } from '@nestjs/common';
import {
  ClassifiedDiffRow,
  DiffComparableRow,
  MatchDecision,
  MOVED_CONFIDENCE_THRESHOLD
} from './diff-contract';
import { DiffFeatureFlagService } from './feature-flag.service';
import { NormalizationService } from './normalization.service';
import { ProfileFieldPolicy } from './profile-adapter.contract';

export interface ClassificationInput {
  sourceRows: DiffComparableRow[];
  targetRows: DiffComparableRow[];
  matches: MatchDecision[];
  unmatchedSourceIds: string[];
  unmatchedTargetIds: string[];
  sourceFieldPolicy?: ProfileFieldPolicy;
  targetFieldPolicy?: ProfileFieldPolicy;
}

export interface ClassificationStats {
  replacementCandidates: number;
  replacementSuppressed: number;
  ambiguityContexts: number;
}

export interface ClassificationResult {
  rows: ClassifiedDiffRow[];
  stats: ClassificationStats;
}

@Injectable()
export class ClassificationService {
  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly featureFlags: DiffFeatureFlagService
  ) {}

  classify(input: ClassificationInput): ClassifiedDiffRow[] {
    return this.classifyWithStats(input).rows;
  }

  classifyWithStats(input: ClassificationInput): ClassificationResult {
    const sourceMap = new Map(
      input.sourceRows.map((row) => [row.rowId, this.normalizationService.normalizeRow(row).row])
    );
    const targetMap = new Map(
      input.targetRows.map((row) => [row.rowId, this.normalizationService.normalizeRow(row).row])
    );

    const rows: ClassifiedDiffRow[] = [];
    const comparableFields = this.resolveComparableFields(input.sourceFieldPolicy, input.targetFieldPolicy);

    for (const match of input.matches) {
      if (match.reviewRequired || !match.targetRowId) {
        continue;
      }
      const source = sourceMap.get(match.sourceRowId);
      const target = targetMap.get(match.targetRowId);
      if (!source || !target) continue;

      const cells = this.buildCellDiffs(source, target, comparableFields);
      const resolution = this.resolveMatchedChangeType(source, target, cells.length, match);
      rows.push({
        sourceRowId: source.rowId,
        targetRowId: target.rowId,
        changeType: resolution.changeType,
        matchedBy: match.strategy,
        reasonCode: `matched_${resolution.changeType}`,
        cells,
        fromParent: resolution.fromParent,
        toParent: resolution.toParent
      });
    }

    const removed = input.unmatchedSourceIds
      .map((id) => sourceMap.get(id))
      .filter((row): row is DiffComparableRow => !!row);
    const added = input.unmatchedTargetIds
      .map((id) => targetMap.get(id))
      .filter((row): row is DiffComparableRow => !!row);

    const replacementResult = this.pairReplacements(removed, added);
    const replacedPairs = replacementResult.pairs;
    const replacedSource = new Set(replacedPairs.map((pair) => pair.source.rowId));
    const replacedTarget = new Set(replacedPairs.map((pair) => pair.target.rowId));

    for (const pair of replacedPairs) {
      rows.push({
        sourceRowId: pair.source.rowId,
        targetRowId: pair.target.rowId,
        changeType: 'replaced',
        reasonCode: 'unmatched_pair_replacement',
        cells: this.buildCellDiffs(pair.source, pair.target, comparableFields)
      });
    }

    for (const row of removed) {
      if (replacedSource.has(row.rowId)) continue;
      rows.push({
        sourceRowId: row.rowId,
        targetRowId: null,
        changeType: 'removed',
        reasonCode: 'unmatched_source_row',
        cells: []
      });
    }

    for (const row of added) {
      if (replacedTarget.has(row.rowId)) continue;
      rows.push({
        sourceRowId: null,
        targetRowId: row.rowId,
        changeType: 'added',
        reasonCode: 'unmatched_target_row',
        cells: []
      });
    }

    const sortedRows = rows.sort((a, b) => {
      const aKey = `${a.sourceRowId || '~'}::${a.targetRowId || '~'}::${a.changeType}`;
      const bKey = `${b.sourceRowId || '~'}::${b.targetRowId || '~'}::${b.changeType}`;
      return aKey.localeCompare(bKey);
    });

    return {
      rows: sortedRows,
      stats: replacementResult.stats
    };
  }

  private resolveMatchedChangeType(
    source: DiffComparableRow,
    target: DiffComparableRow,
    changedCells: number,
    match: MatchDecision
  ): Pick<ClassifiedDiffRow, 'changeType' | 'fromParent' | 'toParent'> {
    const parentChanged = source.parentPath !== target.parentPath || source.position !== target.position;
    if (parentChanged && !match.reviewRequired && match.score >= MOVED_CONFIDENCE_THRESHOLD) {
      return {
        changeType: 'moved',
        fromParent: source.parentPath || null,
        toParent: target.parentPath || null
      };
    }

    if (changedCells === 0) return { changeType: 'no_change', fromParent: null, toParent: null };

    if (source.quantity !== target.quantity && source.partNumber === target.partNumber) {
      const onlyQuantity = this.changedOnlyQuantity(source, target);
      if (onlyQuantity) {
        return { changeType: 'quantity_change', fromParent: null, toParent: null };
      }
    }

    return { changeType: 'modified', fromParent: null, toParent: null };
  }

  private changedOnlyQuantity(source: DiffComparableRow, target: DiffComparableRow): boolean {
    return (
      source.partNumber === target.partNumber &&
      source.revision === target.revision &&
      source.description === target.description &&
      source.supplier === target.supplier &&
      source.plant === target.plant &&
      source.color === target.color &&
      source.units === target.units &&
      source.cost === target.cost &&
      source.category === target.category &&
      source.parentPath === target.parentPath &&
      source.position === target.position &&
      source.quantity !== target.quantity
    );
  }

  private pairReplacements(
    removed: DiffComparableRow[],
    added: DiffComparableRow[]
  ): {
    pairs: Array<{ source: DiffComparableRow; target: DiffComparableRow }>;
    stats: ClassificationStats;
  } {
    const strictAmbiguity = this.featureFlags.isAmbiguityStrictEnabled();
    const usedAdded = new Set<string>();
    const pairs: Array<{ source: DiffComparableRow; target: DiffComparableRow }> = [];
    const replacementThreshold = strictAmbiguity ? 0.9 : 0.8;
    const addedContextCounts = this.contextCounts(added);
    const removedContextCounts = this.contextCounts(removed);
    let replacementCandidates = 0;
    let replacementSuppressed = 0;

    for (const source of removed) {
      const sourceContextKey = this.replacementContextKey(source);
      const sourceContextAmbiguous =
        !!sourceContextKey && (removedContextCounts.get(sourceContextKey) || 0) > 1;

      let candidatePool = added.filter((target) => !usedAdded.has(target.rowId));
      replacementCandidates += candidatePool.length;

      if (strictAmbiguity && sourceContextAmbiguous) {
        replacementSuppressed += candidatePool.length;
        continue;
      }

      if (strictAmbiguity) {
        const before = candidatePool.length;
        candidatePool = candidatePool.filter((target) => {
          const contextKey = this.replacementContextKey(target);
          if (!contextKey) return false;
          return (addedContextCounts.get(contextKey) || 0) <= 1;
        });
        replacementSuppressed += before - candidatePool.length;
      }

      const candidate = candidatePool
        .map((target) => ({
          target,
          similarity: this.replacementSimilarity(source, target)
        }))
        .filter((candidate) => {
          if (!strictAmbiguity) return candidate.similarity.score >= replacementThreshold;
          return candidate.similarity.contextAligned && candidate.similarity.score >= replacementThreshold;
        })
        .sort(
          (a, b) => b.similarity.score - a.similarity.score || a.target.rowId.localeCompare(b.target.rowId)
        )[0];

      if (!candidate) continue;
      usedAdded.add(candidate.target.rowId);
      pairs.push({ source, target: candidate.target });
    }

    const ambiguityContexts = this.countAmbiguityContexts(addedContextCounts) + this.countAmbiguityContexts(removedContextCounts);
    return {
      pairs,
      stats: {
        replacementCandidates,
        replacementSuppressed,
        ambiguityContexts
      }
    };
  }

  private replacementSimilarity(
    a: DiffComparableRow,
    b: DiffComparableRow
  ): { score: number; contextAligned: boolean } {
    let score = 0;
    const parentMatch = !!a.parentPath && !!b.parentPath && a.parentPath === b.parentPath;
    const positionMatch =
      (a.position && b.position && a.position === b.position) ||
      (a.findNumber && b.findNumber && a.findNumber === b.findNumber);
    const descriptionMatch = !!a.description && !!b.description && a.description === b.description;
    const contextAligned = parentMatch && (positionMatch || descriptionMatch);

    if (parentMatch) score += 0.4;
    if (positionMatch) score += 0.25;
    if (descriptionMatch) score += 0.2;
    if (a.quantity !== null && a.quantity !== undefined && a.quantity === b.quantity) score += 0.05;
    if (a.revision && b.revision && a.revision === b.revision) score += 0.05;
    if (a.supplier && b.supplier && a.supplier === b.supplier) score += 0.05;

    return { score: Number(Math.min(1, score).toFixed(6)), contextAligned };
  }

  private resolveComparableFields(
    sourcePolicy?: ProfileFieldPolicy,
    targetPolicy?: ProfileFieldPolicy
  ): Array<keyof DiffComparableRow> {
    const sourceComparable = sourcePolicy?.comparable || [];
    const targetComparable = targetPolicy?.comparable || [];
    if (sourceComparable.length && targetComparable.length) {
      const targetSet = new Set(targetComparable);
      const intersection = sourceComparable.filter((field) => targetSet.has(field));
      if (intersection.length) return intersection;
    }
    if (sourceComparable.length) return [...sourceComparable];
    if (targetComparable.length) return [...targetComparable];
    return DEFAULT_COMPARABLE_FIELDS;
  }

  private buildCellDiffs(
    source: DiffComparableRow,
    target: DiffComparableRow,
    comparableFields: Array<keyof DiffComparableRow>
  ) {
    return comparableFields
      .filter((field) => (source[field] ?? null) !== (target[field] ?? null))
      .map((field) => ({
        field,
        before: (source[field] ?? null) as string | number | null,
        after: (target[field] ?? null) as string | number | null,
        reasonCode: `field_changed_${field}`
      }));
  }

  private replacementContextKey(row: DiffComparableRow): string | null {
    const parent = row.parentPath || '';
    const position = row.position || row.findNumber || '';
    const description = row.description || '';
    if (!parent || (!position && !description)) {
      return null;
    }
    return `${parent}::${position}::${description}`;
  }

  private contextCounts(rows: DiffComparableRow[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = this.replacementContextKey(row);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  private countAmbiguityContexts(counts: Map<string, number>): number {
    let total = 0;
    for (const value of counts.values()) {
      if (value > 1) total += 1;
    }
    return total;
  }
}

const DEFAULT_COMPARABLE_FIELDS: Array<keyof DiffComparableRow> = [
  'internalId',
  'partNumber',
  'revision',
  'description',
  'quantity',
  'supplier',
  'plant',
  'color',
  'units',
  'cost',
  'category',
  'parentPath',
  'position'
];
