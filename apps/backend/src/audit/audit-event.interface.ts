export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.access.denied';

export interface AuditEvent {
  eventType: AuditEventType;
  outcome: 'success' | 'failure' | 'denied';
  actorEmail?: string;
  tenantId?: string;
  provider?: 'google' | 'microsoft';
  reason?: string;
  correlationId: string;
  occurredAtUtc: string;
}
