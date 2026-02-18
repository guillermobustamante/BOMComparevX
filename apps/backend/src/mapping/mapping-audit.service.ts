import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { DetectedColumnCandidate, MappingConfirmationContract } from './mapping-contract';

export interface MappingAuditEntry {
  auditId: string;
  tenantId: string;
  revisionId: string;
  sourceColumn: string | null;
  canonicalField: string | null;
  strategy: string;
  confidence: number | null;
  reviewState: string | null;
  actor: string | null;
  changedFrom: string | null;
  changedTo: string | null;
  timestampUtc: string;
  correlationId: string | null;
}

@Injectable()
export class MappingAuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly inMemoryEntries: MappingAuditEntry[] = [];

  async recordDetectionRun(input: {
    tenantId: string;
    revisionId: string;
    correlationId: string;
    columns: DetectedColumnCandidate[];
  }): Promise<void> {
    for (const column of input.columns) {
      await this.appendEntry({
        tenantId: input.tenantId,
        revisionId: input.revisionId,
        sourceColumn: column.sourceColumn,
        canonicalField: column.canonicalField || null,
        strategy: column.strategy,
        confidence: column.confidence,
        reviewState: column.reviewState,
        actor: null,
        changedFrom: null,
        changedTo: null,
        correlationId: input.correlationId
      });
    }
  }

  async recordConfirmation(input: {
    tenantId: string;
    revisionId: string;
    actor: string;
    correlationId: string;
    payload: MappingConfirmationContract;
  }): Promise<void> {
    for (const mapping of input.payload.mappings) {
      const resolvedTarget = mapping.canonicalField;
      const changedFrom = mapping.originalCanonicalField || null;
      const changedTo = resolvedTarget || null;
      const isManualCorrection = changedFrom !== changedTo;
      await this.appendEntry({
        tenantId: input.tenantId,
        revisionId: input.revisionId,
        sourceColumn: mapping.sourceColumn,
        canonicalField: resolvedTarget || null,
        strategy: isManualCorrection ? 'MANUAL' : mapping.strategy || 'MANUAL',
        confidence: mapping.confidence ?? null,
        reviewState: mapping.reviewState ?? null,
        actor: input.actor,
        changedFrom: isManualCorrection ? changedFrom : null,
        changedTo: isManualCorrection ? changedTo : null,
        correlationId: input.correlationId
      });
    }
  }

  async getByRevision(tenantId: string, revisionId: string): Promise<MappingAuditEntry[]> {
    if (this.databaseService.enabled) {
      const rows = await this.databaseService.client.columnDetectionAudit.findMany({
        where: { tenantId, bomRevisionId: revisionId },
        orderBy: { timestampUtc: 'asc' }
      });
      return rows.map((row) => ({
        auditId: row.auditId,
        tenantId: row.tenantId,
        revisionId: row.bomRevisionId,
        sourceColumn: row.sourceColumn,
        canonicalField: row.canonicalField,
        strategy: row.strategy,
        confidence: row.confidence,
        reviewState: row.reviewState,
        actor: row.actor,
        changedFrom: row.changedFrom,
        changedTo: row.changedTo,
        timestampUtc: row.timestampUtc.toISOString(),
        correlationId: row.correlationId
      }));
    }

    return this.inMemoryEntries
      .filter((entry) => entry.tenantId === tenantId && entry.revisionId === revisionId)
      .sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));
  }

  private async appendEntry(input: Omit<MappingAuditEntry, 'auditId' | 'timestampUtc'>): Promise<void> {
    const entry: MappingAuditEntry = {
      auditId: randomUUID(),
      timestampUtc: new Date().toISOString(),
      ...input
    };
    this.inMemoryEntries.push(entry);

    if (!this.databaseService.enabled) {
      return;
    }

    await this.databaseService.client.columnDetectionAudit.create({
      data: {
        auditId: entry.auditId,
        tenantId: entry.tenantId,
        bomRevisionId: entry.revisionId,
        sourceColumn: entry.sourceColumn,
        canonicalField: entry.canonicalField,
        strategy: entry.strategy,
        confidence: entry.confidence,
        reviewState: entry.reviewState,
        actor: entry.actor,
        changedFrom: entry.changedFrom,
        changedTo: entry.changedTo,
        timestampUtc: new Date(entry.timestampUtc),
        correlationId: entry.correlationId
      }
    });
  }
}
