import { Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  async list(@Req() req: Request): Promise<{
    notifications: Array<{
      notificationId: string;
      type: 'comparison_completed' | 'comparison_failed';
      title: string;
      message: string;
      linkPath: string | null;
      isRead: boolean;
      createdAtUtc: string;
      comparisonId: string | null;
      emailDispatchedAtUtc: string | null;
    }>;
  }> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const rows = await this.notificationsService.listForUser(tenantId, userEmail);
    return {
      notifications: rows.map((row) => ({
        notificationId: row.notificationId,
        type: row.type,
        title: row.title,
        message: row.message,
        linkPath: row.linkPath,
        isRead: row.isRead,
        createdAtUtc: row.createdAtUtc,
        comparisonId: row.comparisonId,
        emailDispatchedAtUtc: row.emailDispatchedAtUtc
      }))
    };
  }

  @Post(':notificationId/read')
  @UseGuards(SessionAuthGuard)
  async markRead(
    @Req() req: Request,
    @Param('notificationId') notificationId: string
  ): Promise<{ ok: true; notificationId: string }> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const row = await this.notificationsService.markRead(tenantId, userEmail, notificationId);
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification was not found.'
      });
    }
    return { ok: true, notificationId };
  }
}
