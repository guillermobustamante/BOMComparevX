export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.access.denied'
  | 'share.invite'
  | 'share.revoke'
  | 'export.download'
  | 'notification.created'
  | 'retention.sweep'
  | 'admin.policy.reset'
  | 'admin.policy.override'
  | 'admin.role.grant'
  | 'history.rename'
  | 'history.tag'
  | 'history.delete'
  | 'consent.accepted'
  | 'audit.export'
  | 'audit.archive.run'
  | 'rate_limit.exempt'
  | 'rate_limit.exceeded';

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
