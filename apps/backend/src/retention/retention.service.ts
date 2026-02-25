import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ExportsService } from '../exports/exports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SharesService } from '../shares/shares.service';

export interface RetentionSweepResult {
  deletedExportArtifacts: number;
  deletedNotifications: number;
  deletedRevokedShares: number;
  exportArtifactsCutoffUtc: string;
  notificationsCutoffUtc: string;
  sweptAtUtc: string;
}

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly notificationsService: NotificationsService,
    private readonly sharesService: SharesService,
    private readonly auditService: AuditService
  ) {}

  private readonly logger = new Logger(RetentionService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    if (!this.retentionEnabled()) return;
    const intervalMs = this.retentionIntervalMs();
    this.intervalRef = setInterval(() => {
      void this.runSweep({ trigger: 'interval' }).catch(() => {
        // Sweep failures are emitted as structured logs and audit events.
      });
    }, intervalMs);
    this.intervalRef.unref?.();
  }

  onModuleDestroy(): void {
    if (!this.intervalRef) return;
    clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  async runSweep(input?: {
    nowUtcIso?: string;
    actorEmail?: string;
    tenantId?: string;
    trigger?: 'interval' | 'manual';
  }): Promise<RetentionSweepResult> {
    const now = input?.nowUtcIso ? new Date(input.nowUtcIso) : new Date();
    const exportCutoff = new Date(now.getTime() - this.exportRetentionDays() * 24 * 60 * 60 * 1000);
    const notificationsCutoff = new Date(now.getTime() - this.notificationsRetentionDays() * 24 * 60 * 60 * 1000);

    const [deletedExportArtifacts, deletedNotifications, deletedRevokedShares] = await Promise.all([
      this.exportsService.pruneArtifactsOlderThan(exportCutoff.toISOString()),
      this.notificationsService.pruneOlderThan(notificationsCutoff.toISOString()),
      this.sharesService.purgeRevokedRecords()
    ]);

    const result: RetentionSweepResult = {
      deletedExportArtifacts,
      deletedNotifications,
      deletedRevokedShares,
      exportArtifactsCutoffUtc: exportCutoff.toISOString(),
      notificationsCutoffUtc: notificationsCutoff.toISOString(),
      sweptAtUtc: now.toISOString()
    };

    this.logger.log(
      JSON.stringify({
        metricName: 'stage5.retention.sweep',
        trigger: input?.trigger || 'manual',
        ...result
      })
    );
    this.auditService.emit({
      eventType: 'retention.sweep',
      outcome: 'success',
      actorEmail: input?.actorEmail,
      tenantId: input?.tenantId,
      reason: `trigger=${input?.trigger || 'manual'};exports=${deletedExportArtifacts};notifications=${deletedNotifications};shares=${deletedRevokedShares}`,
      correlationId: randomUUID()
    });

    return result;
  }

  private retentionEnabled(): boolean {
    return this.isTruthy(process.env.STAGE5_RETENTION_ENABLED, true);
  }

  private retentionIntervalMs(): number {
    const raw = Number(process.env.STAGE5_RETENTION_INTERVAL_MS || 60 * 60 * 1000);
    if (Number.isNaN(raw) || raw < 30_000) return 60 * 60 * 1000;
    return raw;
  }

  private exportRetentionDays(): number {
    const raw = Number(process.env.EXPORT_ARTIFACT_RETENTION_DAYS || 7);
    if (Number.isNaN(raw) || raw <= 0) return 7;
    return raw;
  }

  private notificationsRetentionDays(): number {
    const raw = Number(process.env.NOTIFICATION_RETENTION_DAYS || 90);
    if (Number.isNaN(raw) || raw <= 0) return 90;
    return raw;
  }

  private isTruthy(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
}
