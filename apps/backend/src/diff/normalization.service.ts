import { Injectable } from '@nestjs/common';
import { DiffComparableRow, DiffPropertyValue } from './diff-contract';

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
      occurrenceInternalId: this.normalizeText(input.occurrenceInternalId, false),
      objectInternalId: this.normalizeText(input.objectInternalId, false),
      partNumber: this.normalizePartNumber(input.partNumber),
      revision: this.normalizeText(input.revision, true),
      description: this.normalizeText(input.description, true),
      supplier: this.normalizeText(input.supplier, true),
      plant: this.normalizeText(input.plant, true),
      color: this.normalizeText(input.color, true),
      units: this.normalizeText(input.units, true),
      category: this.normalizeText(input.category, true),
      parentPath: this.normalizeText(input.parentPath, false),
      position: this.normalizeText(input.position, false),
      assemblyPath: this.normalizeText(input.assemblyPath, false),
      findNumber: this.normalizeText(input.findNumber, false),
      hierarchyLevel: this.normalizeNumber(input.hierarchyLevel),
      quantity: this.normalizeNumber(input.quantity),
      cost: this.normalizeNumber(input.cost),
      properties: this.normalizeProperties(input.properties)
    };

    push('internalId', input.internalId, normalized.internalId ?? null, 'text_trim_space');
    push(
      'occurrenceInternalId',
      input.occurrenceInternalId,
      normalized.occurrenceInternalId ?? null,
      'text_trim_space'
    );
    push('objectInternalId', input.objectInternalId, normalized.objectInternalId ?? null, 'text_trim_space');
    push('partNumber', input.partNumber, normalized.partNumber ?? null, 'part_number_case_strip');
    push('revision', input.revision, normalized.revision ?? null, 'text_upper_trim_space');
    push('description', input.description, normalized.description ?? null, 'text_upper_trim_space');
    push('supplier', input.supplier, normalized.supplier ?? null, 'text_upper_trim_space');
    push('plant', input.plant, normalized.plant ?? null, 'text_upper_trim_space');
    push('color', input.color, normalized.color ?? null, 'text_upper_trim_space');
    push('units', input.units, normalized.units ?? null, 'text_upper_trim_space');
    push('category', input.category, normalized.category ?? null, 'text_upper_trim_space');
    push('parentPath', input.parentPath, normalized.parentPath ?? null, 'text_trim_space');
    push('position', input.position, normalized.position ?? null, 'text_trim_space');
    push('assemblyPath', input.assemblyPath, normalized.assemblyPath ?? null, 'text_trim_space');
    push('findNumber', input.findNumber, normalized.findNumber ?? null, 'text_trim_space');
    push('hierarchyLevel', input.hierarchyLevel ?? null, normalized.hierarchyLevel ?? null, 'numeric_normalization');
    push('quantity', input.quantity ?? null, normalized.quantity ?? null, 'numeric_normalization');
    push('cost', input.cost ?? null, normalized.cost ?? null, 'numeric_normalization');

    return { row: normalized, metadata };
  }

  normalizeProperties(
    input: Record<string, DiffPropertyValue> | null | undefined
  ): Record<string, DiffPropertyValue> | undefined {
    if (!input) return undefined;

    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, this.normalizePropertyValue(key, value)])
    );
  }

  normalizePropertyValue(propertyName: string, value: DiffPropertyValue): DiffPropertyValue {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return this.normalizeNumber(value);
    if (typeof value === 'boolean') return value;

    const text = String(value).trim();
    if (!text) return null;

    const dimensionTuple = this.normalizeDimensionTuple(text);
    if (dimensionTuple) {
      return dimensionTuple;
    }

    const lowerProperty = this.normalizePropertyName(propertyName);
    if (
      /\b(quantity|qty|cost|price|weight|mass|height|width|length|depth|diameter|radius|thickness|volume|area)\b/.test(
        lowerProperty
      )
    ) {
      const numeric = this.normalizeNumber(text);
      if (numeric !== null) {
        return numeric;
      }
    }

    if (/^(true|false|yes|no|y|n)$/i.test(text)) {
      return /^(true|yes|y)$/i.test(text);
    }

    return this.normalizeText(text, true);
  }

  normalizePropertyName(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
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

  private normalizeDimensionTuple(value: string): string | null {
    const parts = value
      .split(/x/gi)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length < 2 || parts.length > 3) return null;

    const normalized = parts.map((part) => this.normalizeNumber(part));
    if (normalized.some((part) => part === null)) {
      return null;
    }

    return normalized.map((part) => Number(part).toFixed(6)).join(' x ');
  }
}
