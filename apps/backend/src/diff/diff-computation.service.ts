import { Injectable } from '@nestjs/common';
import {
  DIFF_CONTRACT_VERSION,
  DiffComparableRow,
  DiffJobCounters,
  PersistedDiffRow
} from './diff-contract';
import { ClassificationService } from './classification.service';
import { MatcherService } from './matcher.service';
import { NormalizationService } from './normalization.service';

@Injectable()
export class DiffComputationService {
  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly matcherService: MatcherService,
    private readonly classificationService: ClassificationService
  ) {}

  compute(input: { sourceRows: DiffComparableRow[]; targetRows: DiffComparableRow[] }): {
    contractVersion: string;
    rows: PersistedDiffRow[];
    counters: DiffJobCounters;
  } {
    const source = input.sourceRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const target = input.targetRows.map((row) => this.normalizationService.normalizeRow(row).row);
    const sourceIndex = new Map(source.map((row, index) => [row.rowId, index]));
    const targetIndex = new Map(target.map((row, index) => [row.rowId, index]));
    const sourceById = new Map(source.map((row) => [row.rowId, row]));
    const targetById = new Map(target.map((row) => [row.rowId, row]));

    const matchResult = this.matcherService.match(source, target);
    const classified = this.classificationService.classify({
      sourceRows: source,
      targetRows: target,
      matches: matchResult.matches,
      unmatchedSourceIds: matchResult.unmatchedSourceIds,
      unmatchedTargetIds: matchResult.unmatchedTargetIds
    });

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
          changedFields: row.cells.map((cell) => cell.field)
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

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      rows,
      counters
    };
  }
}
