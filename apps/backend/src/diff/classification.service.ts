import { Injectable } from '@nestjs/common';
import { ClassifiedDiffRow, DiffComparableRow, MatchDecision } from './diff-contract';
import { NormalizationService } from './normalization.service';

export interface ClassificationInput {
  sourceRows: DiffComparableRow[];
  targetRows: DiffComparableRow[];
  matches: MatchDecision[];
  unmatchedSourceIds: string[];
  unmatchedTargetIds: string[];
}

@Injectable()
export class ClassificationService {
  constructor(private readonly normalizationService: NormalizationService) {}

  classify(input: ClassificationInput): ClassifiedDiffRow[] {
    const sourceMap = new Map(
      input.sourceRows.map((row) => [row.rowId, this.normalizationService.normalizeRow(row).row])
    );
    const targetMap = new Map(
      input.targetRows.map((row) => [row.rowId, this.normalizationService.normalizeRow(row).row])
    );

    const rows: ClassifiedDiffRow[] = [];

    for (const match of input.matches) {
      if (match.reviewRequired || !match.targetRowId) {
        continue;
      }
      const source = sourceMap.get(match.sourceRowId);
      const target = targetMap.get(match.targetRowId);
      if (!source || !target) continue;

      const cells = this.buildCellDiffs(source, target);
      const changeType = this.resolveMatchedChangeType(source, target, cells.length);
      rows.push({
        sourceRowId: source.rowId,
        targetRowId: target.rowId,
        changeType,
        matchedBy: match.strategy,
        reasonCode: `matched_${changeType}`,
        cells
      });
    }

    const removed = input.unmatchedSourceIds
      .map((id) => sourceMap.get(id))
      .filter((row): row is DiffComparableRow => !!row);
    const added = input.unmatchedTargetIds
      .map((id) => targetMap.get(id))
      .filter((row): row is DiffComparableRow => !!row);

    const replacedPairs = this.pairReplacements(removed, added);
    const replacedSource = new Set(replacedPairs.map((pair) => pair.source.rowId));
    const replacedTarget = new Set(replacedPairs.map((pair) => pair.target.rowId));

    for (const pair of replacedPairs) {
      rows.push({
        sourceRowId: pair.source.rowId,
        targetRowId: pair.target.rowId,
        changeType: 'replaced',
        reasonCode: 'unmatched_pair_replacement',
        cells: this.buildCellDiffs(pair.source, pair.target)
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

    return rows.sort((a, b) => {
      const aKey = `${a.sourceRowId || '~'}::${a.targetRowId || '~'}::${a.changeType}`;
      const bKey = `${b.sourceRowId || '~'}::${b.targetRowId || '~'}::${b.changeType}`;
      return aKey.localeCompare(bKey);
    });
  }

  private resolveMatchedChangeType(
    source: DiffComparableRow,
    target: DiffComparableRow,
    changedCells: number
  ): ClassifiedDiffRow['changeType'] {
    if (changedCells === 0) return 'no_change';
    if (source.quantity !== target.quantity && source.partNumber === target.partNumber) {
      const onlyQuantity = this.changedOnlyQuantity(source, target);
      if (onlyQuantity) return 'quantity_change';
    }
    if (source.parentPath !== target.parentPath || source.position !== target.position) {
      return 'moved';
    }
    return 'modified';
  }

  private changedOnlyQuantity(source: DiffComparableRow, target: DiffComparableRow): boolean {
    return (
      source.partNumber === target.partNumber &&
      source.revision === target.revision &&
      source.description === target.description &&
      source.supplier === target.supplier &&
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
  ): Array<{ source: DiffComparableRow; target: DiffComparableRow }> {
    const usedAdded = new Set<string>();
    const pairs: Array<{ source: DiffComparableRow; target: DiffComparableRow }> = [];

    for (const source of removed) {
      const candidate = added
        .filter((target) => !usedAdded.has(target.rowId))
        .map((target) => ({
          target,
          score: this.replacementSimilarity(source, target)
        }))
        .filter((candidate) => candidate.score >= 0.8)
        .sort(
          (a, b) => b.score - a.score || a.target.rowId.localeCompare(b.target.rowId)
        )[0];

      if (!candidate) continue;
      usedAdded.add(candidate.target.rowId);
      pairs.push({ source, target: candidate.target });
    }

    return pairs;
  }

  private replacementSimilarity(a: DiffComparableRow, b: DiffComparableRow): number {
    let score = 0;
    if (a.parentPath && b.parentPath && a.parentPath === b.parentPath) score += 0.35;
    if (a.position && b.position && a.position === b.position) score += 0.2;
    if (a.description && b.description && a.description === b.description) score += 0.35;
    if (a.quantity !== null && a.quantity !== undefined && a.quantity === b.quantity) score += 0.1;
    return Number(score.toFixed(6));
  }

  private buildCellDiffs(source: DiffComparableRow, target: DiffComparableRow) {
    const comparableFields: Array<keyof DiffComparableRow> = [
      'internalId',
      'partNumber',
      'revision',
      'description',
      'quantity',
      'supplier',
      'color',
      'units',
      'cost',
      'category',
      'parentPath',
      'position'
    ];

    return comparableFields
      .filter((field) => (source[field] ?? null) !== (target[field] ?? null))
      .map((field) => ({
        field,
        before: (source[field] ?? null) as string | number | null,
        after: (target[field] ?? null) as string | number | null,
        reasonCode: `field_changed_${field}`
      }));
  }
}
