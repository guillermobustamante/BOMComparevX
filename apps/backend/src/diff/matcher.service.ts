import { Injectable } from '@nestjs/common';
import {
  ATTRIBUTE_CONCORDANCE_ORDER,
  DiffComparableRow,
  MatchDecision,
  MatchStrategy,
  NEAR_TIE_DELTA
} from './diff-contract';
import { NormalizationService } from './normalization.service';

export interface MatchResult {
  matches: MatchDecision[];
  unmatchedSourceIds: string[];
  unmatchedTargetIds: string[];
}

@Injectable()
export class MatcherService {
  constructor(private readonly normalizationService: NormalizationService) {}

  match(sourceRows: DiffComparableRow[], targetRows: DiffComparableRow[]): MatchResult {
    const source = sourceRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const target = targetRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const targetById = new Map(target.map((row) => [row.rowId, row]));
    const targetIndex = new Map(target.map((row, idx) => [row.rowId, idx]));

    const unlockedTargets = new Set(target.map((row) => row.rowId));
    const matches: MatchDecision[] = [];
    const unmatchedSources: string[] = [];

    for (const sourceRow of source) {
      const decision = this.matchSingleRow(sourceRow, target, unlockedTargets, targetIndex);
      matches.push(decision);
      if (decision.targetRowId) {
        unlockedTargets.delete(decision.targetRowId);
      } else {
        unmatchedSources.push(sourceRow.rowId);
      }
    }

    const unmatchedTargetIds = [...unlockedTargets].sort(
      (a, b) => (targetIndex.get(a) || 0) - (targetIndex.get(b) || 0)
    );
    return {
      matches,
      unmatchedSourceIds: unmatchedSources,
      unmatchedTargetIds,
    };
  }

  private matchSingleRow(
    sourceRow: DiffComparableRow,
    targets: DiffComparableRow[],
    unlockedTargets: Set<string>,
    targetIndex: Map<string, number>
  ): MatchDecision {
    const strategyChecks: Array<{
      strategy: MatchStrategy;
      predicate: (t: DiffComparableRow) => boolean;
    }> = [
      {
        strategy: 'INTERNAL_ID',
        predicate: (t) => !!sourceRow.internalId && !!t.internalId && sourceRow.internalId === t.internalId
      },
      {
        strategy: 'PART_NUMBER_REVISION',
        predicate: (t) =>
          !!sourceRow.partNumber &&
          !!sourceRow.revision &&
          sourceRow.partNumber === t.partNumber &&
          sourceRow.revision === t.revision
      },
      {
        strategy: 'PART_NUMBER',
        predicate: (t) => !!sourceRow.partNumber && sourceRow.partNumber === t.partNumber
      },
      {
        strategy: 'FUZZY',
        predicate: (t) =>
          this.calculateFuzzyScore(sourceRow, t) >= 0.75 &&
          (!!sourceRow.description || !!sourceRow.partNumber)
      }
    ];

    for (const check of strategyChecks) {
      const candidates = targets.filter((t) => unlockedTargets.has(t.rowId) && check.predicate(t));
      if (!candidates.length) continue;
      const choice = this.resolveCandidate(sourceRow, candidates, check.strategy, targetIndex);
      return choice;
    }

    return {
      sourceRowId: sourceRow.rowId,
      targetRowId: null,
      strategy: 'NO_MATCH',
      score: 0,
      reviewRequired: false,
      tieBreakTrace: ['UNIQUENESS_FIRST'],
      reasonCode: 'no_candidate_found'
    };
  }

  private resolveCandidate(
    source: DiffComparableRow,
    candidates: DiffComparableRow[],
    strategy: MatchStrategy,
    targetIndex: Map<string, number>
  ): MatchDecision {
    if (candidates.length === 1) {
      const chosen = candidates[0];
      const score = this.scoreForStrategy(strategy, source, chosen);
      return {
        sourceRowId: source.rowId,
        targetRowId: chosen.rowId,
        strategy,
        score,
        reviewRequired: false,
        tieBreakTrace: ['UNIQUENESS_FIRST'],
        reasonCode: 'unique_candidate'
      };
    }

    const scored = candidates.map((candidate) => ({
      candidate,
      score: this.scoreForStrategy(strategy, source, candidate),
      concordance: this.attributeConcordance(source, candidate),
      stableIndex: targetIndex.get(candidate.rowId) || Number.MAX_SAFE_INTEGER
    }));

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.concordance - a.concordance ||
        a.stableIndex - b.stableIndex ||
        a.candidate.rowId.localeCompare(b.candidate.rowId)
    );

    const top = scored[0];
    const second = scored[1];
    if (second && Math.abs(top.score - second.score) <= NEAR_TIE_DELTA) {
      return {
        sourceRowId: source.rowId,
        targetRowId: null,
        strategy,
        score: top.score,
        reviewRequired: true,
        tieBreakTrace: ['HIGHEST_SCORE', 'ATTRIBUTE_CONCORDANCE', 'NEAR_TIE_REVIEW_REQUIRED'],
        reasonCode: 'near_tie_review_required'
      };
    }

    return {
      sourceRowId: source.rowId,
      targetRowId: top.candidate.rowId,
      strategy,
      score: top.score,
      reviewRequired: false,
      tieBreakTrace: ['HIGHEST_SCORE', 'ATTRIBUTE_CONCORDANCE', 'STABLE_FALLBACK_INDEX'],
      reasonCode: 'scored_candidate_selected'
    };
  }

  private attributeConcordance(source: DiffComparableRow, target: DiffComparableRow): number {
    let score = 0;
    for (const [idx, field] of ATTRIBUTE_CONCORDANCE_ORDER.entries()) {
      const s = source[field];
      const t = target[field];
      if (s !== null && s !== undefined && t !== null && t !== undefined && s === t) {
        score += ATTRIBUTE_CONCORDANCE_ORDER.length - idx;
      }
    }
    return score;
  }

  private scoreForStrategy(
    strategy: MatchStrategy,
    source: DiffComparableRow,
    target: DiffComparableRow
  ): number {
    if (strategy === 'FUZZY') {
      return this.calculateFuzzyScore(source, target);
    }
    if (strategy === 'PART_NUMBER') {
      return source.partNumber === target.partNumber ? 0.9 + this.attributeConcordance(source, target) * 0.01 : 0;
    }
    if (strategy === 'PART_NUMBER_REVISION') {
      return source.partNumber === target.partNumber && source.revision === target.revision
        ? 0.97 + this.attributeConcordance(source, target) * 0.005
        : 0;
    }
    if (strategy === 'INTERNAL_ID') {
      return source.internalId && source.internalId === target.internalId ? 1 : 0;
    }
    return 0;
  }

  private calculateFuzzyScore(source: DiffComparableRow, target: DiffComparableRow): number {
    const descScore = this.stringSimilarity(source.description || '', target.description || '');
    const pnBonus =
      source.partNumber && target.partNumber && source.partNumber === target.partNumber ? 0.15 : 0;
    const qtyBonus =
      source.quantity !== null &&
      source.quantity !== undefined &&
      target.quantity !== null &&
      target.quantity !== undefined &&
      source.quantity === target.quantity
        ? 0.05
        : 0;
    return Number(Math.min(0.99, descScore + pnBonus + qtyBonus).toFixed(6));
  }

  private stringSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 0.9;
    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;
    return Number((1 - distance / maxLen).toFixed(6));
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
      Array.from({ length: b.length + 1 }, () => 0)
    );
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  }
}
