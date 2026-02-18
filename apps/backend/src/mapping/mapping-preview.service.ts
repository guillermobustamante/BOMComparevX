import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { REQUIRED_CANONICAL_FIELDS, MappingPreviewContract, isRequiredFieldMapped, MAPPING_CONTRACT_VERSION } from './mapping-contract';
import { MappingDetectionService } from './mapping-detection.service';

interface RevisionSeed {
  headers: string[];
  sampleRows: Array<Record<string, string | number | null>>;
}

@Injectable()
export class MappingPreviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mappingDetectionService: MappingDetectionService
  ) {}

  async getPreview(revisionId: string, tenantId: string): Promise<MappingPreviewContract> {
    const seed = await this.resolveSeed(revisionId, tenantId);
    const columns = this.mappingDetectionService.detectColumns(seed.headers, {
      sampleRows: seed.sampleRows
    });

    const requiredFieldsStatus = REQUIRED_CANONICAL_FIELDS.map((field) => ({
      field,
      ...isRequiredFieldMapped(columns, field)
    }));

    return {
      contractVersion: MAPPING_CONTRACT_VERSION,
      revisionId,
      columns,
      sampleRows: seed.sampleRows,
      requiredFieldsStatus,
      canProceed: requiredFieldsStatus.every((status) => status.mapped)
    };
  }

  private async resolveSeed(revisionId: string, tenantId: string): Promise<RevisionSeed> {
    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.bomColumnMapping.findFirst({
        where: { bomRevisionId: revisionId, tenantId },
        orderBy: { createdAtUtc: 'desc' }
      });
      if (row) {
        const parsed = this.parseOriginalColumnsJson(row.originalColumnsJson);
        if (parsed.headers.length > 0) {
          return parsed;
        }
      }
    }

    return this.defaultSeed(revisionId, tenantId);
  }

  private parseOriginalColumnsJson(input: string): RevisionSeed {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
        return {
          headers: parsed,
          sampleRows: []
        };
      }
      if (this.isSeedShape(parsed)) {
        return {
          headers: parsed.headers,
          sampleRows: parsed.sampleRows
        };
      }
    } catch {
      // Fallback to deterministic default seed when persisted payload isn't parseable.
    }
    return { headers: [], sampleRows: [] };
  }

  private defaultSeed(revisionId: string, tenantId: string): RevisionSeed {
    const key = `${tenantId}:${revisionId}`.toLowerCase();
    if (key.includes('preview')) {
      return {
        headers: ['Part Number', 'Descriptin', 'Needed Count', 'Mystery Header'],
        sampleRows: [
          { 'Part Number': 'PN-1001', Descriptin: 'Widget', 'Needed Count': 4, 'Mystery Header': 'n/a' },
          { 'Part Number': 'PN-1002', Descriptin: 'Bracket', 'Needed Count': 7, 'Mystery Header': 'n/a' }
        ]
      };
    }

    return {
      headers: ['Part Number', 'Description', 'Quantity'],
      sampleRows: [
        { 'Part Number': 'PN-2001', Description: 'Screw', Quantity: 10 },
        { 'Part Number': 'PN-2002', Description: 'Nut', Quantity: 10 }
      ]
    };
  }

  private isSeedShape(
    value: unknown
  ): value is { headers: string[]; sampleRows: Array<Record<string, string | number | null>> } {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { headers?: unknown; sampleRows?: unknown };
    return Array.isArray(candidate.headers) && Array.isArray(candidate.sampleRows);
  }
}
