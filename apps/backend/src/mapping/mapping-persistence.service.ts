import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  MappingConfirmationContract,
  MappingReviewState,
  MappingSnapshotContract,
  MAPPING_CONTRACT_VERSION
} from './mapping-contract';

type MappingStrategy = 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL';

@Injectable()
export class MappingPersistenceService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly inMemorySnapshots = new Map<string, MappingSnapshotContract>();

  async confirmRevisionMapping(input: {
    tenantId: string;
    actor: string;
    payload: MappingConfirmationContract;
  }): Promise<MappingSnapshotContract> {
    const revisionId = input.payload.revisionId;
    const key = this.snapshotKey(input.tenantId, revisionId);
    const existing = await this.findSnapshot(input.tenantId, revisionId);
    if (existing) {
      throw new ConflictException({
        code: 'MAPPING_IMMUTABLE_ALREADY_CONFIRMED',
        message: 'Mapping snapshot is immutable and already confirmed for this revision.'
      });
    }

    const normalizedMappings = input.payload.mappings.map((mapping) => ({
      sourceColumn: mapping.sourceColumn,
      canonicalField: mapping.canonicalField === '__unmapped__' ? null : mapping.canonicalField,
      originalCanonicalField: mapping.originalCanonicalField || null,
      strategy: (mapping.strategy || 'MANUAL') as MappingStrategy,
      confidence: mapping.confidence ?? null,
      reviewState: (mapping.reviewState || null) as MappingReviewState | null,
      languageMetadata: mapping.languageMetadata
    }));

    const hasLowConfidence = normalizedMappings.some((mapping) => mapping.reviewState === 'LOW_CONFIDENCE_WARNING');
    if (hasLowConfidence && input.payload.explicitWarningAcknowledged !== true) {
      throw new BadRequestException({
        code: 'MAPPING_CONFIRM_WARNING_ACK_REQUIRED',
        message: 'Low-confidence mappings require explicit warning acknowledgment.'
      });
    }

    const mappingId = randomUUID();
    const confirmedAtUtc = new Date().toISOString();
    const snapshot: MappingSnapshotContract = {
      contractVersion: MAPPING_CONTRACT_VERSION,
      mappingId,
      revisionId,
      tenantId: input.tenantId,
      immutable: true,
      confirmedAtUtc,
      createdBy: input.actor,
      originalColumns: normalizedMappings.map((mapping) => mapping.sourceColumn),
      mappings: normalizedMappings
        .map((mapping) => ({
          sourceColumn: mapping.sourceColumn,
          canonicalField: mapping.canonicalField,
          languageMetadata: mapping.languageMetadata,
          strategy: mapping.strategy,
          confidence: mapping.confidence === null ? undefined : mapping.confidence,
          reviewState: mapping.reviewState === null ? undefined : mapping.reviewState
        }))
        .sort((a, b) => a.sourceColumn.localeCompare(b.sourceColumn))
    };

    this.inMemorySnapshots.set(key, snapshot);

    if (this.databaseService.enabled) {
      await this.databaseService.client.bomColumnMapping.create({
        data: {
          mappingId,
          tenantId: input.tenantId,
          bomRevisionId: revisionId,
          originalColumnsJson: JSON.stringify(snapshot.originalColumns),
          canonicalMappingJson: JSON.stringify(snapshot.mappings),
          customColumnIndicesJson: JSON.stringify([]),
          detectionConfidence: this.averageConfidence(snapshot.mappings),
          languageMetadataJson: JSON.stringify(
            snapshot.mappings.map((mapping) => ({
              sourceColumn: mapping.sourceColumn,
              languageMetadata: mapping.languageMetadata || null
            }))
          ),
          createdAtUtc: new Date(confirmedAtUtc),
          createdBy: input.actor
        }
      });
    }

    return snapshot;
  }

  async getRevisionMapping(tenantId: string, revisionId: string): Promise<MappingSnapshotContract> {
    const snapshot = await this.findSnapshot(tenantId, revisionId);
    if (!snapshot) {
      throw new NotFoundException({
        code: 'MAPPING_NOT_FOUND',
        message: 'No mapping snapshot found for this revision.'
      });
    }
    return snapshot;
  }

  private async findSnapshot(tenantId: string, revisionId: string): Promise<MappingSnapshotContract | null> {
    const key = this.snapshotKey(tenantId, revisionId);
    const inMemory = this.inMemorySnapshots.get(key);
    if (inMemory) return inMemory;

    if (!this.databaseService.enabled) return null;

    const row = await this.databaseService.client.bomColumnMapping.findFirst({
      where: { tenantId, bomRevisionId: revisionId },
      orderBy: { createdAtUtc: 'desc' }
    });
    if (!row) return null;

    const snapshot: MappingSnapshotContract = {
      contractVersion: MAPPING_CONTRACT_VERSION,
      mappingId: row.mappingId,
      revisionId: row.bomRevisionId,
      tenantId: row.tenantId,
      immutable: true,
      confirmedAtUtc: row.createdAtUtc.toISOString(),
      createdBy: row.createdBy || 'unknown',
      originalColumns: this.parseJson<string[]>(row.originalColumnsJson, []),
      mappings: this.parseJson<MappingSnapshotContract['mappings']>(row.canonicalMappingJson, [])
    };
    this.inMemorySnapshots.set(key, snapshot);
    return snapshot;
  }

  private snapshotKey(tenantId: string, revisionId: string): string {
    return `${tenantId}::${revisionId}`;
  }

  private averageConfidence(
    mappings: Array<{
      confidence?: number;
    }>
  ): number | null {
    const values = mappings.map((mapping) => mapping.confidence).filter((value): value is number => typeof value === 'number');
    if (!values.length) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
  }

  private parseJson<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
