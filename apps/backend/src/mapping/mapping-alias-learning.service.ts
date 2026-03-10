import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface LearnedMappingAlias {
  normalizedSourceColumn: string;
  canonicalField: string;
  confirmations: number;
}

@Injectable()
export class MappingAliasLearningService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly inMemory = new Map<string, Map<string, Map<string, number>>>();
  private readonly loadedTenants = new Set<string>();

  async getTenantAliases(tenantId: string): Promise<LearnedMappingAlias[]> {
    await this.ensureTenantLoaded(tenantId);
    return this.toAliases(this.inMemory.get(tenantId));
  }

  async recordConfirmation(
    tenantId: string,
    mappings: Array<{ sourceColumn: string; canonicalField: string | null }>
  ): Promise<void> {
    await this.ensureTenantLoaded(tenantId);
    const bucket = this.ensureTenantBucket(tenantId);
    for (const mapping of mappings) {
      if (!mapping.canonicalField || mapping.canonicalField === '__unmapped__') continue;
      const normalized = this.normalizeHeader(mapping.sourceColumn);
      const perHeader = bucket.get(normalized) || new Map<string, number>();
      perHeader.set(mapping.canonicalField, (perHeader.get(mapping.canonicalField) || 0) + 1);
      bucket.set(normalized, perHeader);
    }
  }

  private async ensureTenantLoaded(tenantId: string): Promise<void> {
    if (this.loadedTenants.has(tenantId)) return;
    this.loadedTenants.add(tenantId);

    if (!this.databaseService.enabled) {
      this.ensureTenantBucket(tenantId);
      return;
    }

    const rows = await this.databaseService.client.bomColumnMapping.findMany({
      where: { tenantId },
      orderBy: { createdAtUtc: 'asc' }
    });

    const bucket = this.ensureTenantBucket(tenantId);
    for (const row of rows) {
      const mappings = this.parseMappings(row.canonicalMappingJson);
      for (const mapping of mappings) {
        if (!mapping.sourceColumn || !mapping.canonicalField) continue;
        const normalized = this.normalizeHeader(mapping.sourceColumn);
        const perHeader = bucket.get(normalized) || new Map<string, number>();
        perHeader.set(mapping.canonicalField, (perHeader.get(mapping.canonicalField) || 0) + 1);
        bucket.set(normalized, perHeader);
      }
    }
  }

  private ensureTenantBucket(tenantId: string): Map<string, Map<string, number>> {
    const existing = this.inMemory.get(tenantId);
    if (existing) return existing;
    const next = new Map<string, Map<string, number>>();
    this.inMemory.set(tenantId, next);
    return next;
  }

  private toAliases(
    bucket: Map<string, Map<string, number>> | undefined
  ): LearnedMappingAlias[] {
    if (!bucket) return [];
    const aliases: LearnedMappingAlias[] = [];
    for (const [normalizedSourceColumn, perField] of bucket.entries()) {
      for (const [canonicalField, confirmations] of perField.entries()) {
        aliases.push({
          normalizedSourceColumn,
          canonicalField,
          confirmations
        });
      }
    }
    return aliases.sort(
      (a, b) =>
        a.normalizedSourceColumn.localeCompare(b.normalizedSourceColumn) ||
        b.confirmations - a.confirmations ||
        a.canonicalField.localeCompare(b.canonicalField)
    );
  }

  private parseMappings(
    value: string
  ): Array<{ sourceColumn?: string; canonicalField?: string | null }> {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as Array<{ sourceColumn?: string; canonicalField?: string | null }> : [];
    } catch {
      return [];
    }
  }

  private normalizeHeader(input: string): string {
    return input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
