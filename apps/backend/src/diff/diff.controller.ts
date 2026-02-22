import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { DiffComparableRow, DiffJobStatusPayload } from './diff-contract';
import { DiffJobService } from './diff-job.service';

@Controller()
export class DiffController {
  constructor(private readonly diffJobService: DiffJobService) {}

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
    return this.diffJobService.startJob({
      tenantId,
      requestedBy: actor,
      sessionId: body?.sessionId,
      leftRevisionId: body?.leftRevisionId,
      rightRevisionId: body?.rightRevisionId,
      sourceRows: body?.sourceRows,
      targetRows: body?.targetRows
    });
  }

  @Get('diff-jobs/:jobId')
  @UseGuards(SessionAuthGuard)
  getDiffJobStatus(@Req() req: Request, @Param('jobId') jobId: string): DiffJobStatusPayload {
    this.ensureFeatureEnabled(
      'DIFF_PROGRESSIVE_API_V1',
      'DIFF_PROGRESSIVE_API_DISABLED',
      'Stage 4 progressive diff API is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    return this.diffJobService.getStatus(jobId, tenantId);
  }

  @Get('diff-jobs/:jobId/rows')
  @UseGuards(SessionAuthGuard)
  getDiffJobRows(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): {
    contractVersion: string;
    jobId: string;
    rows: ReturnType<DiffJobService['getRows']>['rows'];
    nextCursor: string | null;
    loadedRows: number;
    totalRows: number;
  } {
    this.ensureFeatureEnabled(
      'DIFF_PROGRESSIVE_API_V1',
      'DIFF_PROGRESSIVE_API_DISABLED',
      'Stage 4 progressive diff API is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const parsedLimit = Number(limit || 50);
    return this.diffJobService.getRows(jobId, tenantId, cursor, parsedLimit);
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
