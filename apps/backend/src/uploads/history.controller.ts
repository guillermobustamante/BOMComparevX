import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { UploadRevisionService } from './upload-revision.service';
import { UploadHistoryService } from './upload-history.service';

@Controller('history')
export class HistoryController {
  constructor(
    private readonly uploadHistoryService: UploadHistoryService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly auditService: AuditService
  ) {}

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  async listSessions(@Req() req: Request, @Query('sessionId') sessionId?: string) {
    this.ensureFeatureEnabled();
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const requestedSessionId = (sessionId || '').trim() || undefined;
    const sessions = await this.uploadHistoryService.listByUser(tenantId, userEmail, requestedSessionId);
    const latestPair = requestedSessionId
      ? await this.uploadRevisionService.findLatestPairBySession(tenantId, requestedSessionId)
      : null;
    return {
      sessions: await Promise.all(sessions.map(async (entry) => {
        const pair = await this.uploadRevisionService.findPairByJobId(tenantId, entry.jobId);
        const leftFile = pair
          ? await this.uploadRevisionService.getRevisionFileMeta(tenantId, pair.leftRevisionId)
          : null;
        const rightFile = pair
          ? await this.uploadRevisionService.getRevisionFileMeta(tenantId, pair.rightRevisionId)
          : null;
        const generatedLabel =
          leftFile && rightFile ? `${leftFile.fileName} -> ${rightFile.fileName}` : `Comparison ${entry.historyId.slice(0, 8)}`;

        return {
          ...entry,
          leftRevisionId: pair?.leftRevisionId || null,
          rightRevisionId: pair?.rightRevisionId || null,
          comparisonLabel: entry.sessionName || generatedLabel,
          latest: !!latestPair && latestPair.jobId === entry.jobId
        };
      }))
    };
  }

  @Post('sessions/:historyId/rename')
  @UseGuards(SessionAuthGuard)
  async renameSession(
    @Req() req: Request,
    @Param('historyId') historyId: string,
    @Body() body: { sessionName?: string }
  ) {
    this.ensureFeatureEnabled();
    const sessionName = (body.sessionName || '').trim();
    if (sessionName.length > 120) {
      throw new HttpException(
        {
          code: 'HISTORY_RENAME_INVALID',
          message: 'Session name must be 120 characters or fewer.',
          correlationId: randomUUID()
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const updated = await this.uploadHistoryService.renameSession(
      tenantId,
      userEmail,
      historyId,
      sessionName
    );

    if (!updated) {
      throw new NotFoundException({
        code: 'HISTORY_NOT_FOUND',
        message: 'History session was not found.',
        correlationId: randomUUID()
      });
    }

    this.auditService.emit({
      eventType: 'history.rename',
      outcome: 'success',
      actorEmail: userEmail,
      tenantId,
      reason: `historyId=${historyId}`,
      correlationId: randomUUID()
    });

    return { session: updated };
  }

  @Post('sessions/:historyId/tag')
  @UseGuards(SessionAuthGuard)
  async updateTag(
    @Req() req: Request,
    @Param('historyId') historyId: string,
    @Body() body: { tagLabel?: string }
  ) {
    this.ensureFeatureEnabled();
    const tagLabel = (body.tagLabel || '').trim();
    if (tagLabel.length > 50) {
      throw new HttpException(
        {
          code: 'HISTORY_TAG_INVALID',
          message: 'Tag label must be 50 characters or fewer.',
          correlationId: randomUUID()
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const updated = await this.uploadHistoryService.updateTag(
      tenantId,
      userEmail,
      historyId,
      tagLabel
    );

    if (!updated) {
      throw new NotFoundException({
        code: 'HISTORY_NOT_FOUND',
        message: 'History session was not found.',
        correlationId: randomUUID()
      });
    }

    this.auditService.emit({
      eventType: 'history.tag',
      outcome: 'success',
      actorEmail: userEmail,
      tenantId,
      reason: `historyId=${historyId};tag=${tagLabel || 'cleared'}`,
      correlationId: randomUUID()
    });

    return { session: updated };
  }

  @Post('sessions/:historyId/delete')
  @UseGuards(SessionAuthGuard)
  async deleteSession(@Req() req: Request, @Param('historyId') historyId: string) {
    this.ensureFeatureEnabled();
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const deleted = await this.uploadHistoryService.softDelete(tenantId, userEmail, historyId);
    if (!deleted) {
      throw new NotFoundException({
        code: 'HISTORY_NOT_FOUND',
        message: 'History session was not found.',
        correlationId: randomUUID()
      });
    }

    this.auditService.emit({
      eventType: 'history.delete',
      outcome: 'success',
      actorEmail: userEmail,
      tenantId,
      reason: `historyId=${historyId};mode=soft_delete`,
      correlationId: randomUUID()
    });

    return {
      deleted: true,
      historyId
    };
  }

  private ensureFeatureEnabled(): void {
    const raw = process.env.HISTORY_PARITY_V1;
    if (!raw) return;
    const normalized = raw.trim().toLowerCase();
    if (['false', '0', 'off', 'no'].includes(normalized)) {
      throw new ForbiddenException({
        code: 'HISTORY_PARITY_DISABLED',
        message: 'History parity operations are disabled by feature flag.',
        correlationId: randomUUID()
      });
    }
  }
}
