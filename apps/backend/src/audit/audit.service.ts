import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditEvent, AuditEventType } from './audit-event.interface';
import { DatabaseService } from '../database/database.service';

interface EmitAuditInput {
  eventType: AuditEventType;
  outcome: 'success' | 'failure' | 'denied';
  actorEmail?: string;
  tenantId?: string;
  provider?: 'google' | 'microsoft';
  reason?: string;
  correlationId: string;
}

export interface AuditLogRecord {
  id: string;
  timestampUtc: string;
  actorEmail: string | null;
  tenantId: string | null;
  actionType: string;
  resourceType: string | null;
  resourceId: string | null;
  detailsJson: string | null;
  outcome: string | null;
  ipAddress: string | null;
  correlationId: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly logger = new Logger('AuditEvent');
  private readonly inMemoryAuditLog: AuditLogRecord[] = [];

  emit(input: EmitAuditInput): void {
    const event: AuditEvent = {
      ...input,
      occurredAtUtc: new Date().toISOString()
    };

    // Structured JSON for downstream ingestion by log pipeline/SIEM.
    this.logger.log(JSON.stringify(event));
    this.inMemoryAuditLog.push({
      id: randomUUID(),
      timestampUtc: event.occurredAtUtc,
      actorEmail: event.actorEmail || null,
      tenantId: event.tenantId || null,
      actionType: event.eventType,
      resourceType: 'auth',
      resourceId: null,
      detailsJson: JSON.stringify({
        provider: event.provider || null,
        reason: event.reason || null
      }),
      outcome: event.outcome,
      ipAddress: null,
      correlationId: event.correlationId
    });

    if (!this.databaseService.enabled) return;
    void this.databaseService.client.auditLog
      .create({
        data: {
          id: randomUUID(),
          timestampUtc: new Date(event.occurredAtUtc),
          userId: event.actorEmail || null,
          tenantId: event.tenantId || null,
          actionType: event.eventType,
          resourceType: 'auth',
          resourceId: null,
          detailsJson: JSON.stringify({
            provider: event.provider || null,
            reason: event.reason || null
          }),
          outcome: event.outcome,
          ipAddress: null,
          correlationId: event.correlationId
        }
      })
      .catch(() => {
        // Best-effort persistence; structured log emission already occurred.
      });
  }

  async listTenantEvents(input: {
    tenantId: string;
    fromUtcIso?: string;
    toUtcIso?: string;
    actionType?: string;
    outcome?: string;
    actorEmail?: string;
    limit?: number;
  }): Promise<AuditLogRecord[]> {
    const limit = this.normalizeLimit(input.limit);
    const inMemory = this.filterAuditRecords(this.inMemoryAuditLog, input).slice(-limit);

    if (!this.databaseService.enabled) {
      return inMemory.sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc));
    }

    const dbRows = await this.databaseService.client.auditLog.findMany({
      where: {
        tenantId: input.tenantId,
        timestampUtc: {
          gte: input.fromUtcIso ? new Date(input.fromUtcIso) : undefined,
          lte: input.toUtcIso ? new Date(input.toUtcIso) : undefined
        },
        actionType: input.actionType || undefined,
        outcome: input.outcome || undefined,
        userId: input.actorEmail ? input.actorEmail.trim().toLowerCase() : undefined
      },
      orderBy: { timestampUtc: 'asc' },
      take: limit
    });

    const fromDb: AuditLogRecord[] = dbRows.map((row) => ({
      id: row.id,
      timestampUtc: row.timestampUtc.toISOString(),
      actorEmail: row.userId || null,
      tenantId: row.tenantId || null,
      actionType: row.actionType,
      resourceType: row.resourceType || null,
      resourceId: row.resourceId || null,
      detailsJson: row.detailsJson || null,
      outcome: row.outcome || null,
      ipAddress: row.ipAddress || null,
      correlationId: row.correlationId || null
    }));

    const merged = new Map<string, AuditLogRecord>();
    for (const record of [...fromDb, ...inMemory]) {
      const key = [
        record.tenantId || '',
        record.timestampUtc,
        record.actionType,
        record.actorEmail || '',
        record.correlationId || ''
      ].join('::');
      merged.set(key, record);
    }
    return Array.from(merged.values())
      .sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc))
      .slice(-limit);
  }

  private normalizeLimit(value: number | undefined): number {
    const raw = Number(value ?? 1000);
    if (!Number.isFinite(raw) || raw <= 0) return 1000;
    return Math.min(20_000, Math.trunc(raw));
  }

  private filterAuditRecords(
    records: AuditLogRecord[],
    input: {
      tenantId: string;
      fromUtcIso?: string;
      toUtcIso?: string;
      actionType?: string;
      outcome?: string;
      actorEmail?: string;
    }
  ): AuditLogRecord[] {
    const fromUtc = input.fromUtcIso ? Date.parse(input.fromUtcIso) : Number.NEGATIVE_INFINITY;
    const toUtc = input.toUtcIso ? Date.parse(input.toUtcIso) : Number.POSITIVE_INFINITY;
    const actorEmail = input.actorEmail ? input.actorEmail.trim().toLowerCase() : null;

    return records.filter((record) => {
      if (record.tenantId !== input.tenantId) return false;
      const timestampMs = Date.parse(record.timestampUtc);
      if (timestampMs < fromUtc || timestampMs > toUtc) return false;
      if (input.actionType && record.actionType !== input.actionType) return false;
      if (input.outcome && (record.outcome || '') !== input.outcome) return false;
      if (actorEmail && (record.actorEmail || '').toLowerCase() !== actorEmail) return false;
      return true;
    });
  }
}
