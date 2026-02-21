import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const parsedLimit = Number(limit || 50);
    return this.diffJobService.getRows(jobId, tenantId, cursor, parsedLimit);
  }
}
