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

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly logger = new Logger('AuditEvent');

  emit(input: EmitAuditInput): void {
    const event: AuditEvent = {
      ...input,
      occurredAtUtc: new Date().toISOString()
    };

    // Structured JSON for downstream ingestion by log pipeline/SIEM.
    this.logger.log(JSON.stringify(event));

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
}
