import { Injectable } from '@nestjs/common';
import { DiffComparableRow } from './diff-contract';

export interface NormalizationMetadata {
  field: string;
  before: string | number | null | undefined;
  after: string | number | null;
  rule: string;
}

export interface NormalizedRow {
  row: DiffComparableRow;
  metadata: NormalizationMetadata[];
}

@Injectable()
export class NormalizationService {
  normalizeRow(input: DiffComparableRow): NormalizedRow {
    const metadata: NormalizationMetadata[] = [];
    const push = (
      field: string,
      before: string | number | null | undefined,
      after: string | number | null,
      rule: string
    ) => {
      if (before !== after) {
        metadata.push({ field, before, after, rule });
      }
    };

    const normalized: DiffComparableRow = {
      ...input,
      internalId: this.normalizeText(input.internalId, false),
      partNumber: this.normalizePartNumber(input.partNumber),
      revision: this.normalizeText(input.revision, true),
      description: this.normalizeText(input.description, true),
      supplier: this.normalizeText(input.supplier, true),
      color: this.normalizeText(input.color, true),
      units: this.normalizeText(input.units, true),
      category: this.normalizeText(input.category, true),
      parentPath: this.normalizeText(input.parentPath, false),
      position: this.normalizeText(input.position, false),
      quantity: this.normalizeNumber(input.quantity),
      cost: this.normalizeNumber(input.cost)
    };

    push('internalId', input.internalId, normalized.internalId ?? null, 'text_trim_space');
    push('partNumber', input.partNumber, normalized.partNumber ?? null, 'part_number_case_strip');
    push('revision', input.revision, normalized.revision ?? null, 'text_upper_trim_space');
    push('description', input.description, normalized.description ?? null, 'text_upper_trim_space');
    push('supplier', input.supplier, normalized.supplier ?? null, 'text_upper_trim_space');
    push('color', input.color, normalized.color ?? null, 'text_upper_trim_space');
    push('units', input.units, normalized.units ?? null, 'text_upper_trim_space');
    push('category', input.category, normalized.category ?? null, 'text_upper_trim_space');
    push('parentPath', input.parentPath, normalized.parentPath ?? null, 'text_trim_space');
    push('position', input.position, normalized.position ?? null, 'text_trim_space');
    push('quantity', input.quantity ?? null, normalized.quantity ?? null, 'numeric_normalization');
    push('cost', input.cost ?? null, normalized.cost ?? null, 'numeric_normalization');

    return { row: normalized, metadata };
  }

  normalizeText(value: string | null | undefined, uppercase: boolean): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!trimmed) return null;
    return uppercase ? trimmed.toUpperCase() : trimmed;
  }

  normalizePartNumber(value: string | null | undefined): string | null {
    const text = this.normalizeText(value, true);
    if (!text) return null;
    return text.replace(/[-./\s]+/g, '');
  }

  normalizeNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
    return Number(parsed.toFixed(6));
  }

  normalizeWithUom(
    value: number | null | undefined,
    unit: string | null | undefined
  ): { value: number | null; unit: string | null } {
    const n = this.normalizeNumber(value);
    const u = this.normalizeText(unit, true);
    if (n === null || !u) {
      return { value: n, unit: u };
    }

    const lengthToMm: Record<string, number> = { MM: 1, CM: 10, M: 1000, IN: 25.4 };
    const massToG: Record<string, number> = { G: 1, KG: 1000 };
    if (u in lengthToMm) {
      return { value: Number((n * lengthToMm[u]).toFixed(6)), unit: 'MM' };
    }
    if (u in massToG) {
      return { value: Number((n * massToG[u]).toFixed(6)), unit: 'G' };
    }
    return { value: n, unit: u };
  }
}
