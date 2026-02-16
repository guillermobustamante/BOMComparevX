import { Injectable, Logger } from '@nestjs/common';
import { AuditEvent, AuditEventType } from './audit-event.interface';

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
  private readonly logger = new Logger('AuditEvent');

  emit(input: EmitAuditInput): void {
    const event: AuditEvent = {
      ...input,
      occurredAtUtc: new Date().toISOString()
    };

    // Structured JSON for downstream ingestion by log pipeline/SIEM.
    this.logger.log(JSON.stringify(event));
  }
}
