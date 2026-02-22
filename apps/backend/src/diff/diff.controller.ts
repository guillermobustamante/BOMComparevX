import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { SharesService } from '../shares/shares.service';
import { DiffComparableRow, DiffJobStatusPayload } from './diff-contract';
import { DiffJobService } from './diff-job.service';

@Controller()
export class DiffController {
  constructor(
    private readonly diffJobService: DiffJobService,
    private readonly sharesService: SharesService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Post('diff-jobs')
  @UseGuards(SessionAuthGuard)
  async startDiffJob(
    @Req() req: Request,
    @Body()
    body: {
      sessionId?: string;
      leftRevisionId?: string;
      rightRevisionId?: string;
      sourceRows?: DiffComparableRow[];
      targetRows?: DiffComparableRow[];
    }
  ): Promise<DiffJobStatusPayload> {
    this.ensureFeatureEnabled(
      'DIFF_ENGINE_V1',
      'DIFF_ENGINE_DISABLED',
      'Stage 4 diff engine is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actor = session.user?.email || 'unknown-user';
    try {
      return await this.diffJobService.startJob({
        tenantId,
        requestedBy: actor,
        sessionId: body?.sessionId,
        leftRevisionId: body?.leftRevisionId,
        rightRevisionId: body?.rightRevisionId,
        sourceRows: body?.sourceRows,
        targetRows: body?.targetRows
      });
    } catch (error) {
      try {
        await this.notificationsService.createComparisonFailed({
          tenantId,
          userEmail: actor,
          reason: 'Diff job failed to start.'
        });
      } catch {
        // Keep original diff error when notification write fails.
      }
      throw error;
    }
  }

  @Get('diff-jobs/:jobId')
  @UseGuards(SessionAuthGuard)
  async getDiffJobStatus(@Req() req: Request, @Param('jobId') jobId: string): Promise<DiffJobStatusPayload> {
    this.ensureFeatureEnabled(
      'DIFF_PROGRESSIVE_API_V1',
      'DIFF_PROGRESSIVE_API_DISABLED',
      'Stage 4 progressive diff API is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureComparisonReadAccess(jobId, tenantId, actorEmail);
    return this.diffJobService.getStatus(jobId, tenantId);
  }

  @Get('diff-jobs/:jobId/rows')
  @UseGuards(SessionAuthGuard)
  async getDiffJobRows(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): Promise<{
    contractVersion: string;
    jobId: string;
    rows: ReturnType<DiffJobService['getRows']>['rows'];
    nextCursor: string | null;
    loadedRows: number;
    totalRows: number;
  }> {
    this.ensureFeatureEnabled(
      'DIFF_PROGRESSIVE_API_V1',
      'DIFF_PROGRESSIVE_API_DISABLED',
      'Stage 4 progressive diff API is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureComparisonReadAccess(jobId, tenantId, actorEmail);
    const parsedLimit = Number(limit || 50);
    return this.diffJobService.getRows(jobId, tenantId, cursor, parsedLimit);
  }

  private async ensureComparisonReadAccess(
    jobId: string,
    tenantId: string,
    actorEmail: string
  ): Promise<void> {
    const ownerEmail = this.diffJobService.getOwnerEmail(jobId, tenantId);
    if (ownerEmail === actorEmail) return;
    const result = await this.sharesService.canAccessComparison(tenantId, jobId, actorEmail);
    if (result.allowed) return;
    throw new HttpException(
      {
        code: 'SHARE_ACCESS_DENIED',
        message: 'Access to this comparison is not allowed.',
        correlationId: randomUUID()
      },
      HttpStatus.FORBIDDEN
    );
  }

  private ensureFeatureEnabled(flagName: string, code: string, message: string): void {
    if (this.flagEnabled(flagName)) return;
    throw new HttpException(
      {
        code,
        message,
        correlationId: randomUUID(),
        featureFlag: flagName
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  private flagEnabled(flagName: string): boolean {
    const raw = process.env[flagName];
    if (!raw) return true;
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
}
