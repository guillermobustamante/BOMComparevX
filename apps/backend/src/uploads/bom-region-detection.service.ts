import { Injectable } from '@nestjs/common';

export interface BomRegionWarning {
  code: string;
  message: string;
}

export interface BomRegionDetectionResult {
  strategy: 'smart_region' | 'legacy_first_non_empty';
  confidence: number;
  fallbackUsed: boolean;
  warnings: BomRegionWarning[];
  diagnostics: Record<string, unknown>;
  rows: Array<{ sourceRowIndex: number; values: string[] }>;
}

interface CandidateRegion {
  headerRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
  dataEndRowIndex: number;
  confidence: number;
  detectedRows: number;
}

const HEADER_KEYWORDS: Array<{ field: string; aliases: string[] }> = [
  { field: 'description', aliases: ['description', 'desc', 'partname', 'itemname', 'details'] },
  { field: 'partNumber', aliases: ['partnumber', 'partno', 'part', 'part#', 'itemnumber', 'itemno', 'component'] },
  { field: 'quantity', aliases: ['quantity', 'qty', 'count'] },
  { field: 'supplier', aliases: ['supplier', 'vendor', 'manufacturer'] },
  { field: 'units', aliases: ['units', 'unit', 'uom'] },
  { field: 'cost', aliases: ['cost', 'unitcost', 'extendedcost', 'totalcost'] },
  { field: 'category', aliases: ['category', 'group'] },
  { field: 'position', aliases: ['findnumber', 'position', 'itemnumber', 'line'] }
];

const FOOTER_TOKENS = new Set([
  'total',
  'grandtotal',
  'subtotal',
  'statuskey',
  'instructions',
  'instruction',
  'legend',
  'comments'
]);

@Injectable()
export class BomRegionDetectionService {
  detect(rows: Array<{ sourceRowIndex: number; values: string[] }>): BomRegionDetectionResult {
    if (!rows.length) {
      return {
        strategy: 'legacy_first_non_empty',
        confidence: 0,
        fallbackUsed: true,
        warnings: [
          {
            code: 'UPLOAD_BOM_REGION_FALLBACK',
            message: 'We could not confidently isolate the part list, so we used the file as-is.'
          }
        ],
        diagnostics: { reason: 'no_rows' },
        rows
      };
    }

    const smartCandidate = this.findBestCandidate(rows);
    const legacyCandidate = this.legacyCandidate(rows);
    const chosen =
      smartCandidate && smartCandidate.confidence >= Math.max(legacyCandidate.confidence + 0.05, 0.55)
        ? smartCandidate
        : legacyCandidate;
    const strategy = chosen === smartCandidate ? 'smart_region' : 'legacy_first_non_empty';
    const fallbackUsed = strategy !== 'smart_region';
    const excludedNonEmptyContent = this.hasExcludedNonEmptyContent(rows, chosen);
    const warnings: BomRegionWarning[] = [];
    if (fallbackUsed && excludedNonEmptyContent) {
      warnings.push({
        code: 'UPLOAD_BOM_REGION_FALLBACK',
        message:
          'We found extra content around the part list and used the safest available interpretation for this file.'
      });
    } else if (!fallbackUsed && excludedNonEmptyContent && chosen.confidence < 0.85) {
      warnings.push({
        code: 'UPLOAD_BOM_REGION_ESTIMATED',
        message:
          'We found the part list, but this file includes extra content like headers or side notes. Please review results if anything looks incomplete.'
      });
    }

    return {
      strategy,
      confidence: chosen.confidence,
      fallbackUsed,
      warnings,
      diagnostics: {
        strategy,
        smartConfidence: smartCandidate?.confidence ?? 0,
        legacyConfidence: legacyCandidate.confidence,
        headerRowIndex: chosen.headerRowIndex,
        startColumnIndex: chosen.startColumnIndex,
        endColumnIndex: chosen.endColumnIndex,
        dataEndRowIndex: chosen.dataEndRowIndex,
        detectedRows: chosen.detectedRows,
        excludedNonEmptyContent
      },
      rows: this.cropRows(rows, chosen)
    };
  }

  private findBestCandidate(rows: Array<{ sourceRowIndex: number; values: string[] }>): CandidateRegion | null {
    let best: CandidateRegion | null = null;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const headerMatches = this.headerMatches(row.values);
      if (headerMatches.fields.size < 2) continue;

      const region = this.buildCandidate(rows, index, headerMatches.columns);
      if (!region) continue;
      if (!best || region.confidence > best.confidence) {
        best = region;
      }
    }
    return best;
  }

  private buildCandidate(
    rows: Array<{ sourceRowIndex: number; values: string[] }>,
    rowIndex: number,
    matchedColumns: number[]
  ): CandidateRegion | null {
    let startColumnIndex = Math.min(...matchedColumns);
    let endColumnIndex = Math.max(...matchedColumns);
    const expandWindow = Math.min(rows.length - 1, rowIndex + 8);

    while (startColumnIndex > 0 && this.columnLooksLikeTable(rows, startColumnIndex - 1, rowIndex + 1, expandWindow)) {
      startColumnIndex -= 1;
    }
    while (this.columnLooksLikeTable(rows, endColumnIndex + 1, rowIndex + 1, expandWindow)) {
      endColumnIndex += 1;
    }

    let dataEndRowIndex = rowIndex;
    let detectedRows = 0;
    let blankOrNoiseStreak = 0;
    for (let index = rowIndex + 1; index < rows.length; index += 1) {
      const sliced = this.sliceRow(rows[index].values, startColumnIndex, endColumnIndex);
      if (this.isFooterRow(sliced)) {
        break;
      }
      const score = this.bomRowScore(sliced);
      if (score >= 0.55) {
        detectedRows += 1;
        dataEndRowIndex = index;
        blankOrNoiseStreak = 0;
        continue;
      }
      if (sliced.every((value) => value.trim().length === 0)) {
        blankOrNoiseStreak += 1;
        if (detectedRows > 0 && blankOrNoiseStreak >= 2) {
          break;
        }
        continue;
      }

      blankOrNoiseStreak += 1;
      if (detectedRows > 0 && blankOrNoiseStreak >= 2) {
        break;
      }
    }

    if (detectedRows === 0) return null;
    const headerScore = Math.min(0.45, this.headerMatches(rows[rowIndex].values).fields.size * 0.12);
    const dataScore = Math.min(0.35, detectedRows * 0.035);
    const contextScore = this.contextScore(rows, rowIndex);
    const widthPenalty = endColumnIndex - startColumnIndex > 20 ? 0.08 : 0;
    const confidence = Number(Math.max(0, Math.min(1, headerScore + dataScore + contextScore - widthPenalty)).toFixed(3));

    return {
      headerRowIndex: rowIndex,
      startColumnIndex,
      endColumnIndex,
      dataEndRowIndex,
      confidence,
      detectedRows
    };
  }

  private legacyCandidate(rows: Array<{ sourceRowIndex: number; values: string[] }>): CandidateRegion {
    const firstNonEmptyIndex = rows.findIndex((row) => row.values.some((value) => value.trim().length > 0));
    const safeIndex = firstNonEmptyIndex >= 0 ? firstNonEmptyIndex : 0;
    const maxWidth = rows.reduce((max, row) => Math.max(max, row.values.length), 0);
    return {
      headerRowIndex: safeIndex,
      startColumnIndex: 0,
      endColumnIndex: Math.max(0, maxWidth - 1),
      dataEndRowIndex: rows.length - 1,
      confidence: 0.45,
      detectedRows: Math.max(0, rows.length - safeIndex - 1)
    };
  }

  private cropRows(
    rows: Array<{ sourceRowIndex: number; values: string[] }>,
    candidate: CandidateRegion
  ): Array<{ sourceRowIndex: number; values: string[] }> {
    return rows
      .slice(candidate.headerRowIndex, candidate.dataEndRowIndex + 1)
      .map((row) => ({
        sourceRowIndex: row.sourceRowIndex,
        values: this.sliceRow(row.values, candidate.startColumnIndex, candidate.endColumnIndex)
      }));
  }

  private hasExcludedNonEmptyContent(
    rows: Array<{ sourceRowIndex: number; values: string[] }>,
    candidate: CandidateRegion
  ): boolean {
    const hasNonEmptyCell = (values: string[]): boolean => values.some((value) => value.trim().length > 0);
    if (rows.slice(0, candidate.headerRowIndex).some((row) => hasNonEmptyCell(row.values))) {
      return true;
    }
    if (rows.slice(candidate.dataEndRowIndex + 1).some((row) => hasNonEmptyCell(row.values))) {
      return true;
    }

    for (let rowIndex = candidate.headerRowIndex; rowIndex <= candidate.dataEndRowIndex; rowIndex += 1) {
      const values = rows[rowIndex]?.values || [];
      const leading = values.slice(0, candidate.startColumnIndex);
      const trailing = values.slice(candidate.endColumnIndex + 1);
      if (hasNonEmptyCell(leading) || hasNonEmptyCell(trailing)) {
        return true;
      }
    }

    return false;
  }

  private columnLooksLikeTable(
    rows: Array<{ sourceRowIndex: number; values: string[] }>,
    columnIndex: number,
    startRowIndex: number,
    endRowIndex: number
  ): boolean {
    if (columnIndex < 0) return false;
    let nonEmpty = 0;
    let structured = 0;
    let inspected = 0;
    for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex += 1) {
      const value = rows[rowIndex]?.values?.[columnIndex] ?? '';
      inspected += 1;
      if (!value.trim()) continue;
      nonEmpty += 1;
      if (this.looksLikeBusinessValue(value)) structured += 1;
    }
    if (inspected === 0) return false;
    return nonEmpty >= 2 && structured / Math.max(nonEmpty, 1) >= 0.5;
  }

  private headerMatches(values: string[]): { fields: Set<string>; columns: number[] } {
    const fields = new Set<string>();
    const columns: number[] = [];
    values.forEach((value, index) => {
      const normalized = this.normalize(value);
      if (!normalized) return;
      for (const keyword of HEADER_KEYWORDS) {
        if (keyword.aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized))) {
          fields.add(keyword.field);
          columns.push(index);
          return;
        }
      }
    });
    return { fields, columns };
  }

  private contextScore(rows: Array<{ sourceRowIndex: number; values: string[] }>, rowIndex: number): number {
    const contextRows = rows.slice(Math.max(0, rowIndex - 4), rowIndex);
    const joined = contextRows
      .flatMap((row) => row.values)
      .map((value) => this.normalize(value))
      .join(' ');
    if (joined.includes('billofmaterials') || joined.includes('bom')) return 0.15;
    if (joined.includes('partslist') || joined.includes('components')) return 0.1;
    return 0.05;
  }

  private bomRowScore(values: string[]): number {
    const tokens = values.map((value) => value.trim()).filter(Boolean);
    if (!tokens.length) return 0;
    const joined = tokens.map((value) => this.normalize(value)).join(' ');
    if (FOOTER_TOKENS.has(joined)) return 0;

    const partLike = tokens.some((value) => /[A-Za-z].*\d|\d.*[A-Za-z]|^\d+(\.\d+)+$/.test(value));
    const descLike = tokens.some((value) => /[A-Za-z]{3,}/.test(value) && !/^\$?\d+(?:\.\d+)?$/.test(value));
    const qtyLike = tokens.some((value) => /^\$?\d+(?:\.\d+)?$/.test(value.replace(/,/g, '')));
    const businessLike = tokens.filter((value) => this.looksLikeBusinessValue(value)).length;
    const primaryCount = [partLike, descLike, qtyLike].filter(Boolean).length;
    if (primaryCount >= 2) return 1;
    if (primaryCount === 1 && businessLike >= 2) return 0.7;
    if (businessLike >= 3) return 0.6;
    return 0.2;
  }

  private looksLikeBusinessValue(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^\$?\d+(?:\.\d+)?$/.test(trimmed.replace(/,/g, ''))) return true;
    if (/^[A-Za-z]{2,}.*$/.test(trimmed)) return true;
    if (/^\d+(\.\d+)+$/.test(trimmed)) return true;
    return false;
  }

  private isFooterRow(values: string[]): boolean {
    const normalized = values.map((value) => this.normalize(value)).filter(Boolean);
    if (!normalized.length) return false;
    const first = normalized[0];
    if (FOOTER_TOKENS.has(first)) return true;
    if (normalized.slice(0, 3).some((value) => FOOTER_TOKENS.has(value))) return true;
    const joined = normalized.join('');
    return FOOTER_TOKENS.has(joined);
  }

  private sliceRow(values: string[], start: number, end: number): string[] {
    const next: string[] = [];
    for (let index = start; index <= end; index += 1) {
      next.push((values[index] ?? '').trim());
    }
    return next;
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  }
}
