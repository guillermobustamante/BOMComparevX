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
import { DiffJobService } from '../diff/diff-job.service';
import { SharesService } from '../shares/shares.service';
import { UploadRevisionService } from './upload-revision.service';
import { UploadHistoryEntry, UploadHistoryService } from './upload-history.service';

@Controller('history')
export class HistoryController {
  constructor(
    private readonly uploadHistoryService: UploadHistoryService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly diffJobService: DiffJobService,
    private readonly sharesService: SharesService,
    private readonly auditService: AuditService
  ) {}

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  async listSessions(
    @Req() req: Request,
    @Query('sessionId') sessionId?: string,
    @Query('currentComparisonId') currentComparisonId?: string
  ) {
    this.ensureFeatureEnabled();
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const userEmail = session.user?.email || 'unknown-user';
    const requestedSessionId = (sessionId || '').trim() || undefined;
    const historyEntries = requestedSessionId
      ? await this.uploadHistoryService.listBySession(tenantId, requestedSessionId)
      : await this.uploadHistoryService.listByUser(tenantId, userEmail, requestedSessionId);
    const latestHistoryIdBySession = new Map<string, string>();
    for (const entry of historyEntries) {
      if (!latestHistoryIdBySession.has(entry.sessionId)) {
        latestHistoryIdBySession.set(entry.sessionId, entry.historyId);
      }
    }
    const sessions = await Promise.all(
      historyEntries.map((entry) =>
        this.buildSessionEntry({
          entry,
          tenantId,
          userEmail,
          currentComparisonId: (currentComparisonId || '').trim() || undefined,
          latestHistoryId: latestHistoryIdBySession.get(entry.sessionId) || null
        })
      )
    );

    if (
      requestedSessionId &&
      historyEntries.length > 0 &&
      !historyEntries.some((entry) => entry.initiatorEmail === userEmail) &&
      !(await this.hasSharedSessionAccess(tenantId, userEmail, sessions))
    ) {
      throw new ForbiddenException({
        code: 'SESSION_HISTORY_ACCESS_DENIED',
        message: 'Access to this session chain is not allowed.',
        correlationId: randomUUID()
      });
    }

    return {
      sessions
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
    const target = await this.uploadHistoryService.findByHistoryId(tenantId, historyId);
    if (!target || target.deletedAtUtc) {
      throw new NotFoundException({
        code: 'HISTORY_NOT_FOUND',
        message: 'History session was not found.',
        correlationId: randomUUID()
      });
    }

    const sessionEntries = await this.uploadHistoryService.listBySession(tenantId, target.sessionId);
    const latestEntry = sessionEntries[0] || null;
    if (!latestEntry || latestEntry.historyId !== historyId) {
      throw new HttpException(
        {
          code: 'HISTORY_DELETE_NOT_LATEST',
          message: 'Only the latest comparison in a session can be deleted.',
          correlationId: randomUUID()
        },
        HttpStatus.CONFLICT
      );
    }

    const nextActiveEntry = sessionEntries[1] || null;
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

    const nextActiveSessionEntry = nextActiveEntry
      ? await this.buildSessionEntry({
          entry: nextActiveEntry,
          tenantId,
          userEmail,
          latestHistoryId: nextActiveEntry.historyId
        })
      : null;

    return {
      deleted: true,
      historyId,
      sessionId: target.sessionId,
      nextActiveHistoryId: nextActiveSessionEntry?.historyId || null,
      nextActiveComparisonId: nextActiveSessionEntry?.comparisonId || null,
      nextActiveLeftRevisionId: nextActiveSessionEntry?.leftRevisionId || null,
      nextActiveRightRevisionId: nextActiveSessionEntry?.rightRevisionId || null
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

  private async buildSessionEntry(input: {
    entry: UploadHistoryEntry;
    tenantId: string;
    userEmail: string;
    currentComparisonId?: string;
    latestHistoryId: string | null;
  }): Promise<{
    historyId: string;
    jobId: string;
    sessionId: string;
    sessionName: string | null;
    tagLabel: string | null;
    deletedAtUtc: string | null;
    deletedBy: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    status: string;
    initiatorEmail: string;
    tenantId: string;
    comparisonId: string | null;
    leftRevisionId: string | null;
    rightRevisionId: string | null;
    comparisonLabel: string;
    comparisonDateLabel: string;
    current: boolean;
    latest: boolean;
    canRename: boolean;
    canDelete: boolean;
  }> {
    const pair = await this.uploadRevisionService.findPairByJobId(input.tenantId, input.entry.jobId);
    const leftFile = pair
      ? await this.uploadRevisionService.getRevisionFileMeta(input.tenantId, pair.leftRevisionId)
      : null;
    const rightFile = pair
      ? await this.uploadRevisionService.getRevisionFileMeta(input.tenantId, pair.rightRevisionId)
      : null;
    const comparisonDateLabel = this.formatComparisonDateLabel(input.entry.createdAtUtc);
    const generatedLabel =
      rightFile?.fileName || leftFile?.fileName
        ? `${rightFile?.fileName || leftFile?.fileName} (${comparisonDateLabel})`
        : `Comparison ${input.entry.historyId.slice(0, 8)} (${comparisonDateLabel})`;
    const comparison = pair
      ? await this.diffJobService.findComparisonByRevisionPair({
          tenantId: input.tenantId,
          sessionId: input.entry.sessionId,
          leftRevisionId: pair.leftRevisionId,
          rightRevisionId: pair.rightRevisionId
        })
      : null;

    return {
      ...input.entry,
      comparisonId: comparison?.comparisonId || null,
      leftRevisionId: pair?.leftRevisionId || null,
      rightRevisionId: pair?.rightRevisionId || null,
      comparisonLabel: generatedLabel,
      comparisonDateLabel,
      status: comparison?.status || input.entry.status,
      current: !!comparison?.comparisonId && comparison.comparisonId === input.currentComparisonId,
      latest: input.latestHistoryId === input.entry.historyId,
      canRename: input.entry.initiatorEmail === input.userEmail,
      canDelete: input.entry.initiatorEmail === input.userEmail && input.latestHistoryId === input.entry.historyId
    };
  }

  private formatComparisonDateLabel(createdAtUtc: string): string {
    const value = new Date(createdAtUtc);
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
  }

  private async hasSharedSessionAccess(
    tenantId: string,
    userEmail: string,
    entries: Array<{ comparisonId: string | null }>
  ): Promise<boolean> {
    for (const entry of entries) {
      if (!entry.comparisonId) continue;
      const access = await this.sharesService.canAccessComparison(tenantId, entry.comparisonId, userEmail);
      if (access.allowed) {
        return true;
      }
    }
    return false;
  }
}
