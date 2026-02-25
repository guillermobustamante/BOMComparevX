import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { NotificationRecord } from './notification-record.interface';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService
  ) {}

  private readonly notificationsById = new Map<string, NotificationRecord>();

  async createComparisonCompleted(input: {
    tenantId: string;
    userEmail: string;
    comparisonId: string;
  }): Promise<NotificationRecord> {
    return this.createNotification({
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      type: 'comparison_completed',
      comparisonId: input.comparisonId,
      title: 'Comparison completed',
      message: `Comparison ${input.comparisonId} finished successfully.`,
      linkPath: `/results?comparisonId=${encodeURIComponent(input.comparisonId)}`
    });
  }

  async createComparisonFailed(input: {
    tenantId: string;
    userEmail: string;
    comparisonId?: string;
    reason?: string;
  }): Promise<NotificationRecord> {
    const comparisonId = input.comparisonId || null;
    return this.createNotification({
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      type: 'comparison_failed',
      comparisonId,
      title: 'Comparison failed',
      message: input.reason || 'Comparison processing failed.',
      linkPath: comparisonId ? `/results?comparisonId=${encodeURIComponent(comparisonId)}` : '/results'
    });
  }

  async listForUser(tenantId: string, userEmail: string): Promise<NotificationRecord[]> {
    const normalizedEmail = this.normalizeEmail(userEmail);
    if (this.databaseService.enabled) {
      const rows = await this.databaseService.client.notification.findMany({
        where: {
          tenantId,
          userEmail: normalizedEmail
        },
        orderBy: { createdAtUtc: 'desc' }
      });
      const mapped = rows.map((row) => this.fromRow(row));
      for (const row of mapped) {
        this.notificationsById.set(row.notificationId, row);
      }
      return mapped;
    }

    return [...this.notificationsById.values()]
      .filter((row) => row.tenantId === tenantId && row.userEmail === normalizedEmail)
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  }

  async markRead(tenantId: string, userEmail: string, notificationId: string): Promise<NotificationRecord | null> {
    const normalizedEmail = this.normalizeEmail(userEmail);
    const inMemory = this.notificationsById.get(notificationId);
    if (inMemory && inMemory.tenantId === tenantId && inMemory.userEmail === normalizedEmail) {
      const updated: NotificationRecord = { ...inMemory, isRead: true };
      this.notificationsById.set(notificationId, updated);
    }

    if (this.databaseService.enabled) {
      const updated = await this.databaseService.client.notification.updateMany({
        where: {
          notificationId,
          tenantId,
          userEmail: normalizedEmail
        },
        data: {
          isRead: true
        }
      });
      if (updated.count === 0) return null;
      const row = await this.databaseService.client.notification.findUnique({
        where: { notificationId }
      });
      if (!row) return null;
      const mapped = this.fromRow(row);
      this.notificationsById.set(mapped.notificationId, mapped);
      return mapped;
    }

    return this.notificationsById.get(notificationId) || null;
  }

  async pruneOlderThan(cutoffUtcIso: string): Promise<number> {
    const cutoff = new Date(cutoffUtcIso);
    let removed = 0;

    for (const [notificationId, notification] of this.notificationsById.entries()) {
      if (new Date(notification.createdAtUtc) < cutoff) {
        this.notificationsById.delete(notificationId);
        removed += 1;
      }
    }

    if (this.databaseService.enabled) {
      const result = await this.databaseService.client.notification.deleteMany({
        where: {
          createdAtUtc: {
            lt: cutoff
          }
        }
      });
      return result.count;
    }

    return removed;
  }

  private async createNotification(input: {
    tenantId: string;
    userEmail: string;
    type: NotificationRecord['type'];
    comparisonId: string | null;
    title: string;
    message: string;
    linkPath: string | null;
  }): Promise<NotificationRecord> {
    const createdAtUtc = new Date().toISOString();
    const emailDispatchedAtUtc = this.emailEnabled() ? createdAtUtc : null;
    const record: NotificationRecord = {
      notificationId: randomUUID(),
      tenantId: input.tenantId,
      userEmail: this.normalizeEmail(input.userEmail),
      type: input.type,
      comparisonId: input.comparisonId,
      title: input.title,
      message: input.message,
      linkPath: input.linkPath,
      isRead: false,
      createdAtUtc,
      emailDispatchedAtUtc,
      detailsJson: null
    };

    this.notificationsById.set(record.notificationId, record);
    if (this.databaseService.enabled) {
      await this.databaseService.client.notification.create({
        data: {
          notificationId: record.notificationId,
          tenantId: record.tenantId,
          userEmail: record.userEmail,
          type: record.type,
          comparisonId: record.comparisonId,
          title: record.title,
          message: record.message,
          linkPath: record.linkPath,
          isRead: record.isRead,
          createdAtUtc: new Date(record.createdAtUtc),
          emailDispatchedAtUtc: record.emailDispatchedAtUtc ? new Date(record.emailDispatchedAtUtc) : null,
          detailsJson: record.detailsJson
        }
      });
    }

    this.auditService.emit({
      eventType: 'notification.created',
      outcome: 'success',
      actorEmail: record.userEmail,
      tenantId: record.tenantId,
      reason: `${record.type};comparison=${record.comparisonId || 'none'}`,
      correlationId: record.notificationId
    });

    return record;
  }

  private emailEnabled(): boolean {
    const raw = (process.env.NOTIFICATIONS_EMAIL_ENABLED || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private fromRow(row: {
    notificationId: string;
    tenantId: string;
    userEmail: string;
    type: string;
    comparisonId: string | null;
    title: string;
    message: string;
    linkPath: string | null;
    isRead: boolean;
    createdAtUtc: Date;
    emailDispatchedAtUtc: Date | null;
    detailsJson: string | null;
  }): NotificationRecord {
    return {
      notificationId: row.notificationId,
      tenantId: row.tenantId,
      userEmail: row.userEmail,
      type: row.type === 'comparison_failed' ? 'comparison_failed' : 'comparison_completed',
      comparisonId: row.comparisonId,
      title: row.title,
      message: row.message,
      linkPath: row.linkPath,
      isRead: row.isRead,
      createdAtUtc: row.createdAtUtc.toISOString(),
      emailDispatchedAtUtc: row.emailDispatchedAtUtc ? row.emailDispatchedAtUtc.toISOString() : null,
      detailsJson: row.detailsJson
    };
  }
}
