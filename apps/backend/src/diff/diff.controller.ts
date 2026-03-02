import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { SharesService } from '../shares/shares.service';
import {
  DiffComparableRow,
  DiffJobStatusPayload,
  DiffRowsQueryDescriptor,
  DiffRowsQueryFilter,
  DiffTreeResponse,
  PersistedDiffRow
} from './diff-contract';
import { DiffFeatureFlagService } from './feature-flag.service';
import { DiffJobService } from './diff-job.service';

@Controller()
export class DiffController {
  private readonly logger = new Logger(DiffController.name);

  constructor(
    private readonly diffJobService: DiffJobService,
    private readonly diffFeatureFlagService: DiffFeatureFlagService,
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
    @Query('limit') limit?: string,
    @Query('searchText') searchText?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('filters') filters?: string
  ): Promise<{
    contractVersion: string;
    jobId: string;
    rows: PersistedDiffRow[];
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
    const dynamicQueryRequested = !!(
      searchText?.trim() ||
      sortBy?.trim() ||
      sortDir ||
      filters?.trim()
    );
    if (dynamicQueryRequested && !this.diffFeatureFlagService.isResultsDynamicFiltersEnabled()) {
      this.emitOperationalMetric('stage7.dynamic_query.failure', {
        reason: 'dynamic_filters_disabled',
        path: 'rows'
      });
      throw new HttpException(
        {
          code: 'RESULTS_DYNAMIC_FILTERS_DISABLED',
          message: 'Dynamic results filtering is disabled by feature flag.',
          correlationId: randomUUID()
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const parsedLimit = Number(limit || 50);
    return this.diffJobService.getRows(jobId, tenantId, cursor, parsedLimit, this.parseRowsQuery({
      searchText,
      sortBy,
      sortDir,
      filters
    }));
  }

  @Get('diff-jobs/:jobId/tree')
  @UseGuards(SessionAuthGuard)
  async getDiffJobTree(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('expandedNodeIds') expandedNodeIds?: string,
    @Query('searchText') searchText?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('filters') filters?: string
  ): Promise<DiffTreeResponse> {
    this.ensureFeatureEnabled(
      'DIFF_PROGRESSIVE_API_V1',
      'DIFF_PROGRESSIVE_API_DISABLED',
      'Stage 4 progressive diff API is currently disabled by feature flag.'
    );
    if (!this.diffFeatureFlagService.isResultsTreeViewEnabled()) {
      throw new HttpException(
        {
          code: 'RESULTS_TREE_VIEW_DISABLED',
          message: 'Hierarchy tree view is disabled by feature flag.',
          correlationId: randomUUID()
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureComparisonReadAccess(jobId, tenantId, actorEmail);
    const dynamicQueryRequested = !!(
      searchText?.trim() ||
      sortBy?.trim() ||
      sortDir ||
      filters?.trim()
    );
    if (dynamicQueryRequested && !this.diffFeatureFlagService.isResultsDynamicFiltersEnabled()) {
      this.emitOperationalMetric('stage7.dynamic_query.failure', {
        reason: 'dynamic_filters_disabled',
        path: 'tree'
      });
      throw new HttpException(
        {
          code: 'RESULTS_DYNAMIC_FILTERS_DISABLED',
          message: 'Dynamic results filtering is disabled by feature flag.',
          correlationId: randomUUID()
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const parsedLimit = Number(limit || 50);
    const expanded = this.parseExpandedNodeIds(expandedNodeIds);
    return this.diffJobService.getTree(
      jobId,
      tenantId,
      cursor,
      parsedLimit,
      expanded,
      this.parseRowsQuery({
        searchText,
        sortBy,
        sortDir,
        filters
      })
    );
  }

  private async ensureComparisonReadAccess(
    jobId: string,
    tenantId: string,
    actorEmail: string
  ): Promise<void> {
    const ownerEmail = await this.diffJobService.getOwnerEmail(jobId, tenantId);
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

  private parseRowsQuery(input: {
    searchText?: string;
    sortBy?: string;
    sortDir?: string;
    filters?: string;
  }): DiffRowsQueryDescriptor | undefined {
    const query: DiffRowsQueryDescriptor = {};
    if (input.searchText?.trim()) {
      query.searchText = input.searchText.trim();
    }
    if (input.sortBy?.trim()) {
      query.sortBy = input.sortBy.trim();
    }
    if (input.sortDir === 'asc' || input.sortDir === 'desc') {
      query.sortDir = input.sortDir;
    }

    if (input.filters?.trim()) {
      try {
        const parsed = JSON.parse(input.filters) as DiffRowsQueryFilter[];
        if (!Array.isArray(parsed)) {
          throw new Error('filters must be an array');
        }
        query.filters = parsed;
      } catch {
        this.emitOperationalMetric('stage7.dynamic_query.failure', {
          reason: 'invalid_filters_payload'
        });
        throw new HttpException(
          {
            code: 'DIFF_ROWS_QUERY_INVALID',
            message: 'Invalid "filters" query payload. Expected JSON array.'
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (!query.searchText && !query.sortBy && !query.sortDir && !query.filters?.length) {
      return undefined;
    }
    return query;
  }

  private parseExpandedNodeIds(raw: string | undefined): string[] {
    if (!raw || !raw.trim()) return [];
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private emitOperationalMetric(metricName: string, details: Record<string, unknown>): void {
    this.logger.log(
      JSON.stringify({
        metricName,
        details,
        emittedAtUtc: new Date().toISOString()
      })
    );
  }
}
