import { Injectable } from '@nestjs/common';
import { DiffComparableRow } from './diff-contract';
import {
  ProfileAdapterContext,
  ProfileAdapterName,
  ProfileAdapterResult,
  ProfileFieldPolicy
} from './profile-adapter.contract';

@Injectable()
export class ProfileAdapterService {
  adaptRows(input: { rows: DiffComparableRow[]; context?: ProfileAdapterContext }): ProfileAdapterResult {
    const detected = this.detectProfile(input.context);
    if (detected.profileName === 'sap') {
      return this.adaptSapRows(input.rows, detected.confidence);
    }
    return this.adaptGenericRows(input.rows, detected.confidence);
  }

  private detectProfile(context?: ProfileAdapterContext): { profileName: ProfileAdapterName; confidence: number } {
    const headers = (context?.headers || []).map((header) => this.normalizeHeader(header));
    const fileName = this.normalizeHeader(context?.fileName || '');

    let sapScore = 0;
    if (headers.some((header) => header.includes('componentnumber'))) sapScore += 2;
    if (headers.some((header) => header.includes('pathpredecessor'))) sapScore += 2;
    if (headers.some((header) => header.includes('explosionlevel'))) sapScore += 1;
    if (headers.some((header) => header.includes('itemnode'))) sapScore += 1;
    if (headers.some((header) => header === 'plant' || header.includes('plant'))) sapScore += 1;
    if (fileName.includes('sap')) sapScore += 1;

    if (sapScore >= 3) {
      return { profileName: 'sap', confidence: Number(Math.min(1, sapScore / 7).toFixed(3)) };
    }

    const genericConfidence = headers.length > 0 ? 0.75 : 0.6;
    return { profileName: 'generic', confidence: genericConfidence };
  }

  private adaptSapRows(rows: DiffComparableRow[], confidence: number): ProfileAdapterResult {
    const occurrences = new Map<string, number>();
    const adapted = rows.map((row) => {
      const parent = this.keyToken(row.parentPath || row.assemblyPath || 'ROOT');
      const level = row.hierarchyLevel ?? 'NA';
      const slot = this.keyToken(row.position || row.findNumber || row.internalId || 'NA');
      const descriptor = this.keyToken(row.description || 'NA');
      const base = `sap|parent:${parent}|level:${level}|slot:${slot}|desc:${descriptor}`;
      const occurrence = this.nextOccurrence(occurrences, base);
      const stableOccurrenceKey = `${base}|occ:${occurrence}`;
      const snapshotRowKey = `${stableOccurrenceKey}|row:${this.keyToken(row.rowId)}`;

      return {
        ...row,
        internalId: row.internalId || stableOccurrenceKey,
        stableOccurrenceKey,
        snapshotRowKey,
        profileName: 'sap',
        profileConfidence: confidence
      };
    });

    return {
      profileName: 'sap',
      confidence,
      rows: adapted,
      fieldPolicy: SAP_FIELD_POLICY
    };
  }

  private adaptGenericRows(rows: DiffComparableRow[], confidence: number): ProfileAdapterResult {
    const occurrences = new Map<string, number>();
    const adapted = rows.map((row) => {
      const baseKey = this.genericStableBaseKey(row);
      const stableOccurrenceKey = baseKey
        ? `${baseKey}|occ:${this.nextOccurrence(occurrences, baseKey)}`
        : null;
      const snapshotRowKey = `${stableOccurrenceKey || 'generic|no_stable_key'}|row:${this.keyToken(row.rowId)}`;

      return {
        ...row,
        internalId: row.internalId || stableOccurrenceKey,
        stableOccurrenceKey,
        snapshotRowKey,
        profileName: 'generic',
        profileConfidence: confidence
      };
    });

    return {
      profileName: 'generic',
      confidence,
      rows: adapted,
      fieldPolicy: GENERIC_FIELD_POLICY
    };
  }

  private genericStableBaseKey(row: DiffComparableRow): string | null {
    const parent = this.keyToken(row.parentPath || row.assemblyPath || '');
    const level = row.hierarchyLevel ?? 'NA';
    const slot = this.keyToken(row.position || row.findNumber || '');
    const partNumber = this.keyToken(row.partNumber || '');
    const revision = this.keyToken(row.revision || '');
    const description = this.keyToken(row.description || '');

    if (parent && slot) {
      return `generic|parent:${parent}|level:${level}|slot:${slot}`;
    }
    if (partNumber && parent) {
      return `generic|pn:${partNumber}|rev:${revision || 'NA'}|parent:${parent}`;
    }
    if (partNumber && description) {
      return `generic|pn:${partNumber}|rev:${revision || 'NA'}|desc:${description}`;
    }
    if (description && parent) {
      return `generic|desc:${description}|parent:${parent}|level:${level}`;
    }
    if (row.internalId) {
      return `generic|internal:${this.keyToken(row.internalId)}`;
    }
    return null;
  }

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  private keyToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9:_/.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private nextOccurrence(counter: Map<string, number>, base: string): number {
    const next = (counter.get(base) || 0) + 1;
    counter.set(base, next);
    return next;
  }
}

const SAP_FIELD_POLICY: ProfileFieldPolicy = {
  identity: ['stableOccurrenceKey', 'snapshotRowKey'],
  comparable: ['partNumber', 'revision', 'description', 'quantity', 'supplier', 'plant', 'cost', 'color', 'units'],
  display: ['assemblyPath', 'findNumber', 'profileName', 'profileConfidence'],
  businessImpact: ['supplier', 'plant', 'cost', 'quantity']
};

const GENERIC_FIELD_POLICY: ProfileFieldPolicy = {
  identity: ['stableOccurrenceKey', 'snapshotRowKey'],
  comparable: ['partNumber', 'revision', 'description', 'quantity', 'supplier', 'plant', 'cost', 'color', 'units'],
  display: ['assemblyPath', 'findNumber', 'profileName', 'profileConfidence'],
  businessImpact: ['supplier', 'plant', 'cost', 'quantity']
};
