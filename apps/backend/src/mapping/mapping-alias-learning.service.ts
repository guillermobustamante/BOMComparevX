import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export interface LearnedMappingAlias {
  normalizedSourceColumn: string;
  canonicalField: string;
  confirmations: number;
}

export interface ReviewedMappingAlias extends LearnedMappingAlias {
  isEnabled: boolean;
  confidenceBand: 'emerging' | 'trusted' | 'established';
}

@Injectable()
export class MappingAliasLearningService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly inMemory = new Map<string, Map<string, Map<string, number>>>();
  private readonly loadedTenants = new Set<string>();
  private readonly decisionsByTenant = new Map<string, Map<string, boolean>>();

  async getTenantAliases(tenantId: string): Promise<LearnedMappingAlias[]> {
    await this.ensureTenantLoaded(tenantId);
    const decisions = this.decisionsByTenant.get(tenantId) || new Map<string, boolean>();
    return this.toAliases(this.inMemory.get(tenantId)).filter(
      (alias) => decisions.get(this.decisionKey(alias.normalizedSourceColumn, alias.canonicalField)) !== false
    );
  }

  async getTenantAliasesForReview(tenantId: string): Promise<ReviewedMappingAlias[]> {
    await this.ensureTenantLoaded(tenantId);
    const decisions = this.decisionsByTenant.get(tenantId) || new Map<string, boolean>();
    return this.toAliases(this.inMemory.get(tenantId)).map((alias) => ({
      ...alias,
      isEnabled: decisions.get(this.decisionKey(alias.normalizedSourceColumn, alias.canonicalField)) !== false,
      confidenceBand:
        alias.confirmations >= 10 ? 'established' : alias.confirmations >= 3 ? 'trusted' : 'emerging'
    }));
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

  async setAliasEnabled(input: {
    tenantId: string;
    normalizedSourceColumn: string;
    canonicalField: string;
    isEnabled: boolean;
    actorEmail?: string;
  }): Promise<void> {
    await this.ensureTenantLoaded(input.tenantId);
    const normalizedSourceColumn = this.normalizeHeader(input.normalizedSourceColumn);
    const canonicalField = input.canonicalField.trim();
    const decisions = this.ensureDecisionBucket(input.tenantId);
    decisions.set(this.decisionKey(normalizedSourceColumn, canonicalField), input.isEnabled);

    if (!this.databaseService.enabled) return;

    const now = new Date();
    await this.databaseService.client.tenantAliasDecision.upsert({
      where: {
        tenantId_normalizedSourceColumn_canonicalField: {
          tenantId: input.tenantId,
          normalizedSourceColumn,
          canonicalField
        }
      },
      update: {
        isEnabled: input.isEnabled,
        updatedAtUtc: now,
        updatedBy: input.actorEmail ? input.actorEmail.trim().toLowerCase() : null
      },
      create: {
        decisionId: randomUUID(),
        tenantId: input.tenantId,
        normalizedSourceColumn,
        canonicalField,
        isEnabled: input.isEnabled,
        createdAtUtc: now,
        updatedAtUtc: now,
        updatedBy: input.actorEmail ? input.actorEmail.trim().toLowerCase() : null
      }
    });
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
    const decisions = await this.databaseService.client.tenantAliasDecision.findMany({
      where: { tenantId }
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

    const decisionBucket = this.ensureDecisionBucket(tenantId);
    for (const decision of decisions) {
      decisionBucket.set(
        this.decisionKey(decision.normalizedSourceColumn, decision.canonicalField),
        decision.isEnabled
      );
    }
  }

  private ensureTenantBucket(tenantId: string): Map<string, Map<string, number>> {
    const existing = this.inMemory.get(tenantId);
    if (existing) return existing;
    const next = new Map<string, Map<string, number>>();
    this.inMemory.set(tenantId, next);
    return next;
  }

  private ensureDecisionBucket(tenantId: string): Map<string, boolean> {
    const existing = this.decisionsByTenant.get(tenantId);
    if (existing) return existing;
    const next = new Map<string, boolean>();
    this.decisionsByTenant.set(tenantId, next);
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

  private decisionKey(normalizedSourceColumn: string, canonicalField: string): string {
    return `${normalizedSourceColumn}::${canonicalField}`;
  }
}
