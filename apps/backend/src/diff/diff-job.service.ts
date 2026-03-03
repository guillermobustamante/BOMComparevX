import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SharesService } from '../shares/shares.service';
import { UploadRevisionService } from '../uploads/upload-revision.service';
import {
  ContainsEdge,
  DIFF_CONTRACT_VERSION,
  DiffComparableRow,
  DiffJobCounters,
  DiffRowsQueryDescriptor,
  DiffRowsQueryFilter,
  DiffJobStatusPayload,
  DiffTreeNode,
  DiffTreeResponse,
  PartNode,
  PersistedDiffRow
} from './diff-contract';
import { DiffComputationService } from './diff-computation.service';
import { DiffFeatureFlagService } from './feature-flag.service';
import { ProfileAdapterContext } from './profile-adapter.contract';

interface DiffJobRecord {
  jobId: string;
  tenantId: string;
  requestedBy: string;
  sessionId?: string;
  leftRevisionId?: string;
  rightRevisionId?: string;
  createdAtUtc: string;
  startedAtMs: number;
  computeDurationMs: number;
  contractVersion: string;
  rows: PersistedDiffRow[];
  counters: DiffJobCounters;
  diagnostics?: {
    sourceProfile: string;
    targetProfile: string;
    sourceKeyCollisionRate: number;
    targetKeyCollisionRate: number;
    ambiguityRate: number;
    unmatchedRate: number;
    replacementSuppressionRate: number;
    profileSelectionDistribution: Record<string, number>;
    flags: {
      profileAdaptersEnabled: boolean;
      compositeKeyEnabled: boolean;
      ambiguityStrictEnabled: boolean;
    };
  };
  firstStatusLatencyMs?: number;
  firstRowsLatencyMs?: number;
  firstTreeResponseLatencyMs?: number;
  firstMeaningfulTreeRowsLatencyMs?: number;
  completionLatencyMs?: number;
  completionMetricEmitted: boolean;
  completionNotificationEmitted: boolean;
  snapshotSource: 'live' | 'persisted';
  executionState: 'queued' | 'running' | 'completed' | 'failed';
  estimatedTotalRows: number;
  failure?: {
    code: string;
    message: string;
  };
}

@Injectable()
export class DiffJobService {
  constructor(
    private readonly diffComputationService: DiffComputationService,
    private readonly diffFeatureFlagService: DiffFeatureFlagService,
    private readonly databaseService: DatabaseService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly sharesService: SharesService,
    private readonly notificationsService: NotificationsService
  ) {}

  private readonly logger = new Logger(DiffJobService.name);
  private readonly jobs = new Map<string, DiffJobRecord>();
  private readonly graphSnapshots = new Map<
    string,
    {
      nodes: PartNode[];
      edges: ContainsEdge[];
    }
  >();

  async startJob(input: {
    tenantId: string;
    requestedBy: string;
    sessionId?: string;
    leftRevisionId?: string;
    rightRevisionId?: string;
    sourceRows?: DiffComparableRow[];
    targetRows?: DiffComparableRow[];
  }): Promise<DiffJobStatusPayload> {
    const startedAtMs = Date.now();

    const revisionPair =
      input.leftRevisionId && input.rightRevisionId
        ? { leftRevisionId: input.leftRevisionId, rightRevisionId: input.rightRevisionId }
        : input.sessionId
          ? this.uploadRevisionService.findLatestPairBySession(input.tenantId, input.sessionId)
          : null;

    const revisionRows =
      revisionPair && revisionPair.leftRevisionId && revisionPair.rightRevisionId
        ? {
            sourceRows:
              this.uploadRevisionService.getRevisionRows(input.tenantId, revisionPair.leftRevisionId) || [],
            targetRows:
              this.uploadRevisionService.getRevisionRows(input.tenantId, revisionPair.rightRevisionId) || []
          }
        : null;
    const revisionTemplates =
      revisionPair && revisionPair.leftRevisionId && revisionPair.rightRevisionId
        ? {
            sourceTemplate:
              this.uploadRevisionService.getRevisionTemplate(input.tenantId, revisionPair.leftRevisionId) || null,
            targetTemplate:
              this.uploadRevisionService.getRevisionTemplate(input.tenantId, revisionPair.rightRevisionId) || null
          }
        : null;

    if (
      (input.leftRevisionId || input.rightRevisionId || input.sessionId) &&
      (!revisionRows || !revisionRows.sourceRows.length || !revisionRows.targetRows.length) &&
      !(input.sourceRows?.length && input.targetRows?.length)
    ) {
      throw new BadRequestException({
        code: 'DIFF_JOB_REVISION_ROWS_UNAVAILABLE',
        message: 'Revision rows are unavailable for requested session/revisions.'
      });
    }

    const sourceRows =
      input.sourceRows?.length
        ? input.sourceRows
        : revisionRows?.sourceRows?.length
          ? revisionRows.sourceRows
          : this.defaultSourceRows();
    const targetRows =
      input.targetRows?.length
        ? input.targetRows
        : revisionRows?.targetRows?.length
          ? revisionRows.targetRows
          : this.defaultTargetRows();

    const jobId = randomUUID();
    const createdAtUtc = new Date().toISOString();
    const record: DiffJobRecord = {
      jobId,
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      sessionId: input.sessionId,
      leftRevisionId: revisionPair?.leftRevisionId || input.leftRevisionId,
      rightRevisionId: revisionPair?.rightRevisionId || input.rightRevisionId,
      createdAtUtc,
      startedAtMs,
      computeDurationMs: 0,
      contractVersion: DIFF_CONTRACT_VERSION,
      rows: [],
      counters: this.emptyCounters(),
      completionMetricEmitted: false,
      completionNotificationEmitted: false,
      snapshotSource: 'live',
      executionState: 'queued',
      estimatedTotalRows: Math.max(sourceRows.length, targetRows.length),
      failure: undefined
    };
    this.jobs.set(jobId, record);
    this.sharesService.registerOwnerContext({
      tenantId: input.tenantId,
      comparisonId: jobId,
      ownerEmail: input.requestedBy
    });

    if (this.databaseService.enabled) {
      await this.databaseService.client.uploadEvent.create({
        data: {
          eventId: randomUUID(),
          tenantId: input.tenantId,
          userKey: input.requestedBy,
          eventType: 'diff.job.created',
          correlationId: jobId,
          detailsJson: JSON.stringify({
            estimatedTotalRows: record.estimatedTotalRows,
            executionState: record.executionState
          }),
          createdAtUtc: new Date(createdAtUtc)
        }
      });
    }

    const runInput = {
      sourceRows,
      targetRows,
      sourceContext: revisionTemplates?.sourceTemplate
        ? {
            fileName: revisionTemplates.sourceTemplate.fileName,
            sheetName: revisionTemplates.sourceTemplate.sheetName || undefined,
            headers: revisionTemplates.sourceTemplate.headers,
            headerFields: revisionTemplates.sourceTemplate.headerFields
          }
        : undefined,
      targetContext: revisionTemplates?.targetTemplate
        ? {
            fileName: revisionTemplates.targetTemplate.fileName,
            sheetName: revisionTemplates.targetTemplate.sheetName || undefined,
            headers: revisionTemplates.targetTemplate.headers,
            headerFields: revisionTemplates.targetTemplate.headerFields
          }
        : undefined,
      revisionPair
    };

    if (record.estimatedTotalRows >= this.getAsyncStartThreshold()) {
      setImmediate(() => {
        void this.runJob(record, runInput);
      });
    } else {
      await this.runJob(record, runInput);
    }

    return this.getStatus(jobId, input.tenantId);
  }

  async getStatus(jobId: string, tenantId: string): Promise<DiffJobStatusPayload> {
    const job = await this.requireTenantJob(jobId, tenantId);
    const progress = this.progress(job);
    if (job.firstStatusLatencyMs === undefined) {
      job.firstStatusLatencyMs = Date.now() - job.startedAtMs;
      this.emitMetricEvent(job, 'stage4.diff.first_status', {
        firstStatusLatencyMs: job.firstStatusLatencyMs
      });
    }
    if (job.executionState === 'completed' && progress.status === 'completed' && !job.completionMetricEmitted) {
      job.completionLatencyMs = Date.now() - job.startedAtMs;
      job.completionMetricEmitted = true;
      this.emitMetricEvent(job, 'stage4.diff.completed', {
        completionLatencyMs: job.completionLatencyMs,
        totalRows: job.rows.length,
        counters: job.counters
      });
    }
    if (job.executionState === 'completed' && progress.status === 'completed' && !job.completionNotificationEmitted) {
      job.completionNotificationEmitted = true;
      void this.notificationsService
        .createComparisonCompleted({
          tenantId: job.tenantId,
          userEmail: job.requestedBy,
          comparisonId: job.jobId
        })
        .catch(() => {
          // Best-effort notification creation.
        });
    }
    const nextCursor = progress.loadedRows < progress.totalRows ? String(progress.loadedRows) : null;

    return {
      contractVersion: job.contractVersion,
      jobId: job.jobId,
      phase: progress.phase,
      percentComplete: progress.percentComplete,
      counters: job.counters,
      loadedRows: progress.loadedRows,
      totalRows: progress.totalRows,
      nextCursor,
      status: progress.status,
      ...(job.executionState === 'failed' && job.failure
        ? {
            errorCode: job.failure.code,
            errorMessage: job.failure.message
          }
        : {})
    };
  }

  async getRows(
    jobId: string,
    tenantId: string,
    cursor: string | undefined,
    limit: number,
    query?: DiffRowsQueryDescriptor
  ): Promise<{
    contractVersion: string;
    jobId: string;
    rows: PersistedDiffRow[];
    nextCursor: string | null;
    loadedRows: number;
    totalRows: number;
  }> {
    const job = await this.requireTenantJob(jobId, tenantId);
    const progress = this.progress(job);
    if (job.firstRowsLatencyMs === undefined && progress.loadedRows > 0) {
      job.firstRowsLatencyMs = Date.now() - job.startedAtMs;
      this.emitMetricEvent(job, 'stage4.diff.first_rows', {
        firstRowsLatencyMs: job.firstRowsLatencyMs
      });
    }

    const queryStartedAtMs = Date.now();
    const availableRows = progress.loadedRows;
    const projectedRows = this.applyRowsQuery(job.rows.slice(0, availableRows), query);
    const start = this.parseCursor(cursor);
    const boundedLimit = Math.min(Math.max(limit || 50, 1), 200);
    const end = Math.min(start + boundedLimit, projectedRows.length);
    const rows = projectedRows.slice(start, end);
    const nextCursor = end < projectedRows.length ? String(end) : null;

    if (query && this.diffFeatureFlagService.isObsS7DynamicQueryP95Enabled()) {
      this.emitMetricEvent(job, 'stage7.dynamic_query.timing', {
        requestDurationMs: Date.now() - queryStartedAtMs,
        cursor: start,
        limit: boundedLimit,
        returnedRows: rows.length,
        totalRows: projectedRows.length
      });
    }

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      jobId,
      rows,
      nextCursor,
      loadedRows: projectedRows.length,
      totalRows: projectedRows.length
    };
  }

  async getTree(
    jobId: string,
    tenantId: string,
    cursor: string | undefined,
    limit: number,
    expandedNodeIds: string[],
    query?: DiffRowsQueryDescriptor
  ): Promise<DiffTreeResponse> {
    const callStartedAtMs = Date.now();
    const job = await this.requireTenantJob(jobId, tenantId);
    const progress = this.progress(job);

    const availableRows = progress.loadedRows;
    const projectedRows = this.applyRowsQuery(job.rows.slice(0, availableRows), query);
    const treeNodes = this.buildTreeNodes(projectedRows);
    const visibleNodes = this.buildVisibleTree(treeNodes, new Set(expandedNodeIds));

    const start = this.parseCursor(cursor);
    const boundedLimit = Math.min(Math.max(limit || 50, 1), 200);
    const end = Math.min(start + boundedLimit, visibleNodes.length);
    const pagedNodes = visibleNodes.slice(start, end);
    const nextCursor = end < visibleNodes.length ? String(end) : null;
    const hasMore = nextCursor !== null;

    if (job.firstTreeResponseLatencyMs === undefined && visibleNodes.length > 0) {
      job.firstTreeResponseLatencyMs = Date.now() - job.startedAtMs;
      if (this.diffFeatureFlagService.isObsS7FirstHierarchyResponseEnabled()) {
        this.emitMetricEvent(job, 'stage7.tree.first_response', {
          firstHierarchyResponseLatencyMs: job.firstTreeResponseLatencyMs
        });
      }
    }

    if (job.firstMeaningfulTreeRowsLatencyMs === undefined && pagedNodes.length > 0) {
      job.firstMeaningfulTreeRowsLatencyMs = Date.now() - job.startedAtMs;
      if (this.diffFeatureFlagService.isObsS7FirstMeaningfulTreeRowsEnabled()) {
        this.emitMetricEvent(job, 'stage7.tree.first_meaningful_rows', {
          firstMeaningfulTreeRowsLatencyMs: job.firstMeaningfulTreeRowsLatencyMs,
          returnedRows: pagedNodes.length
        });
      }
    }

    if (this.diffFeatureFlagService.isObsS7TreeExpandP95Enabled()) {
      this.emitMetricEvent(job, 'stage7.tree.query_timing', {
        requestDurationMs: Date.now() - callStartedAtMs,
        expandedNodeCount: expandedNodeIds.length,
        cursor: start,
        limit: boundedLimit,
        returnedRows: pagedNodes.length,
        totalVisibleRows: visibleNodes.length
      });
    }

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      jobId,
      nodes: pagedNodes.map((node) => ({
        nodeId: node.nodeId,
        parentNodeId: node.parentNodeId,
        depth: node.depth,
        hasChildren: node.hasChildren,
        rowId: node.rowId,
        changeType: node.changeType,
        keyFields: node.keyFields,
        changedFields: node.changedFields,
        fromParent: node.fromParent,
        toParent: node.toParent
      })),
      nextCursor,
      hasMore,
      loadedRows: visibleNodes.length,
      totalRows: visibleNodes.length
    };
  }

  async getRowsForExport(
    jobId: string,
    tenantId: string
  ): Promise<{
    contractVersion: string;
    jobId: string;
    sessionId: string | null;
    leftRevisionId: string | null;
    rightRevisionId: string | null;
    rows: PersistedDiffRow[];
    counters: DiffJobCounters;
  }> {
    const job = await this.requireTenantJob(jobId, tenantId);

    return {
      contractVersion: job.contractVersion,
      jobId: job.jobId,
      sessionId: job.sessionId || null,
      leftRevisionId: job.leftRevisionId || null,
      rightRevisionId: job.rightRevisionId || null,
      rows: job.rows,
      counters: job.counters
    };
  }

  async getOwnerEmail(jobId: string, tenantId: string): Promise<string> {
    const job = await this.requireTenantJob(jobId, tenantId);
    return job.requestedBy;
  }

  private async runJob(
    record: DiffJobRecord,
    input: {
      sourceRows: DiffComparableRow[];
      targetRows: DiffComparableRow[];
      sourceContext?: ProfileAdapterContext;
      targetContext?: ProfileAdapterContext;
      revisionPair: {
        leftRevisionId: string;
        rightRevisionId: string;
      } | null;
    }
  ): Promise<void> {
    record.executionState = 'running';
    const computeStartedAtMs = Date.now();
    const graphMatcherEnabled = this.diffFeatureFlagService.isMatcherGraphEnabled();
    let snapshotCount = 0;
    try {
      if (graphMatcherEnabled && input.revisionPair?.leftRevisionId) {
        await this.ensureRevisionGraphSnapshot(
          record.tenantId,
          input.revisionPair.leftRevisionId,
          input.sourceRows
        );
        snapshotCount += 1;
      }
      if (graphMatcherEnabled && input.revisionPair?.rightRevisionId) {
        await this.ensureRevisionGraphSnapshot(
          record.tenantId,
          input.revisionPair.rightRevisionId,
          input.targetRows
        );
        snapshotCount += 1;
      }

      const computed = this.diffComputationService.compute({
        sourceRows: input.sourceRows,
        targetRows: input.targetRows,
        sourceContext: input.sourceContext,
        targetContext: input.targetContext
      });

      record.computeDurationMs = Date.now() - computeStartedAtMs;
      record.contractVersion = computed.contractVersion;
      record.rows = computed.rows;
      record.counters = computed.counters;
      record.diagnostics = computed.diagnostics;
      record.executionState = 'completed';
      record.failure = undefined;

      this.emitMetricEvent(record, 'stage4.diff.compute', {
        computeDurationMs: record.computeDurationMs,
        sourceRows: input.sourceRows.length,
        targetRows: input.targetRows.length
      });
      this.emitMetricEvent(record, 'stage7.adapter.quality', {
        sourceProfile: computed.diagnostics.sourceProfile,
        targetProfile: computed.diagnostics.targetProfile,
        sourceKeyCollisionRate: computed.diagnostics.sourceKeyCollisionRate,
        targetKeyCollisionRate: computed.diagnostics.targetKeyCollisionRate,
        ambiguityRate: computed.diagnostics.ambiguityRate,
        unmatchedRate: computed.diagnostics.unmatchedRate,
        replacementSuppressionRate: computed.diagnostics.replacementSuppressionRate,
        profileSelectionDistribution: computed.diagnostics.profileSelectionDistribution,
        flags: computed.diagnostics.flags
      });
      this.emitMetricEvent(record, 'stage7.matcher.graph.utilization', {
        matcherGraphFlagEnabled: graphMatcherEnabled,
        graphSnapshotsEnsured: snapshotCount,
        hasRevisionPair: !!input.revisionPair
      });
      if (this.diffFeatureFlagService.isObsS7OverheadVsS4Enabled()) {
        this.emitMetricEvent(record, 'stage7.matcher.overhead_vs_s4', {
          computeDurationMs: record.computeDurationMs,
          sourceRows: input.sourceRows.length,
          targetRows: input.targetRows.length
        });
      }

      if (this.databaseService.enabled) {
        await this.databaseService.client.diffSnapshot.create({
          data: {
            snapshotId: randomUUID(),
            comparisonId: record.jobId,
            tenantId: record.tenantId,
            requestedBy: record.requestedBy,
            sessionId: record.sessionId || null,
            leftRevisionId: record.leftRevisionId || null,
            rightRevisionId: record.rightRevisionId || null,
            contractVersion: record.contractVersion,
            countersJson: JSON.stringify(record.counters),
            rowsJson: JSON.stringify(record.rows),
            createdAtUtc: new Date(record.createdAtUtc)
          }
        });
      }
    } catch (error) {
      record.executionState = 'failed';
      record.failure = {
        code: 'DIFF_JOB_COMPUTE_FAILED',
        message: 'Diff computation failed.'
      };
      this.logger.error(
        `Diff job failed for ${record.jobId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      this.emitMetricEvent(record, 'stage4.diff.failed', {
        reason: record.failure.message
      });
      if (this.databaseService.enabled) {
        await this.databaseService.client.uploadEvent.create({
          data: {
            eventId: randomUUID(),
            tenantId: record.tenantId,
            userKey: record.requestedBy,
            eventType: 'diff.job.failed',
            correlationId: record.jobId,
            detailsJson: JSON.stringify({
              code: record.failure.code,
              message: record.failure.message
            }),
            createdAtUtc: new Date()
          }
        });
      }
      await this.notificationsService
        .createComparisonFailed({
          tenantId: record.tenantId,
          userEmail: record.requestedBy,
          reason: 'Diff job failed during compute.'
        })
        .catch(() => {
          // best-effort failure notification
        });
    }
  }

  private emptyCounters(): DiffJobCounters {
    return {
      total: 0,
      added: 0,
      removed: 0,
      replaced: 0,
      modified: 0,
      moved: 0,
      quantity_change: 0,
      no_change: 0
    };
  }

  private getAsyncStartThreshold(): number {
    const raw = process.env.DIFF_ASYNC_START_ROW_THRESHOLD;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5000;
    }
    return Math.floor(parsed);
  }

  private async requireTenantJob(jobId: string, tenantId: string): Promise<DiffJobRecord> {
    let job = this.jobs.get(jobId);
    if (!job) {
      job = await this.loadPersistedSnapshotJob(jobId, tenantId);
      if (job) {
        this.jobs.set(jobId, job);
      }
    }
    if (!job) {
      throw new NotFoundException({
        code: 'DIFF_JOB_NOT_FOUND',
        message: 'Diff job not found.'
      });
    }
    if (job.tenantId !== tenantId) {
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'Cross-tenant access is not allowed.'
      });
    }
    return job;
  }

  private progress(job: DiffJobRecord): {
    loadedRows: number;
    totalRows: number;
    percentComplete: number;
    phase: 'matching' | 'classifying' | 'finalizing' | 'completed';
    status: 'running' | 'completed';
  } {
    if (job.snapshotSource === 'persisted') {
      return {
        loadedRows: job.rows.length,
        totalRows: job.rows.length,
        percentComplete: 100,
        phase: 'completed',
        status: 'completed'
      };
    }
    if (job.executionState === 'failed') {
      return {
        loadedRows: 0,
        totalRows: Math.max(job.estimatedTotalRows, job.rows.length),
        percentComplete: 100,
        phase: 'completed',
        status: 'completed'
      };
    }
    if (job.executionState === 'completed') {
      return {
        loadedRows: job.rows.length,
        totalRows: job.rows.length,
        percentComplete: 100,
        phase: 'completed',
        status: 'completed'
      };
    }

    const elapsedMs = Date.now() - job.startedAtMs;
    const isQueued = job.executionState === 'queued';
    const percentComplete = isQueued
      ? Math.min(15, 5 + Math.floor(elapsedMs / 500))
      : Math.min(95, 15 + Math.floor(elapsedMs / 1000) * 2);

    return {
      loadedRows: 0,
      totalRows: Math.max(job.estimatedTotalRows, 0),
      percentComplete,
      phase: isQueued ? 'matching' : percentComplete >= 66 ? 'finalizing' : percentComplete >= 33 ? 'classifying' : 'matching',
      status: 'running'
    };
  }

  private parseCursor(cursor: string | undefined): number {
    if (!cursor) return 0;
    const parsed = Number(cursor);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  private async loadPersistedSnapshotJob(jobId: string, tenantId: string): Promise<DiffJobRecord | undefined> {
    if (!this.databaseService.enabled) return undefined;
    const snapshot = await this.databaseService.client.diffSnapshot.findFirst({
      where: {
        comparisonId: jobId,
        tenantId
      }
    });
    if (!snapshot) return undefined;

    const rows = this.parseRowsJson(snapshot.rowsJson);
    const counters = this.parseCountersJson(snapshot.countersJson, rows);
    const startedAtMs = snapshot.createdAtUtc.getTime();
    return {
      jobId: snapshot.comparisonId,
      tenantId: snapshot.tenantId,
      requestedBy: snapshot.requestedBy,
      sessionId: snapshot.sessionId || undefined,
      leftRevisionId: snapshot.leftRevisionId || undefined,
      rightRevisionId: snapshot.rightRevisionId || undefined,
      createdAtUtc: snapshot.createdAtUtc.toISOString(),
      startedAtMs,
      computeDurationMs: 0,
      contractVersion: snapshot.contractVersion,
      rows,
      counters,
      completionMetricEmitted: true,
      completionNotificationEmitted: true,
      snapshotSource: 'persisted',
      executionState: 'completed',
      estimatedTotalRows: rows.length,
      failure: undefined
    };
  }

  private parseRowsJson(raw: string): PersistedDiffRow[] {
    try {
      const parsed = JSON.parse(raw) as PersistedDiffRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseCountersJson(raw: string, rows: PersistedDiffRow[]): DiffJobCounters {
    try {
      const parsed = JSON.parse(raw) as DiffJobCounters;
      if (parsed && typeof parsed.total === 'number') {
        return parsed;
      }
    } catch {
      // ignore parse issues and compute fallback
    }

    return rows.reduce<DiffJobCounters>(
      (acc, row) => {
        acc.total += 1;
        acc[row.changeType] += 1;
        return acc;
      },
      {
        total: 0,
        added: 0,
        removed: 0,
        replaced: 0,
        modified: 0,
        moved: 0,
        quantity_change: 0,
        no_change: 0
      }
    );
  }

  private buildTreeNodes(
    rows: PersistedDiffRow[]
  ): Array<
    DiffTreeNode & {
      sortSourceIndex: number;
      sortTargetIndex: number;
      parentPathKey: string | null;
      pathKey: string;
    }
  > {
    const treeRows = rows.map((row) => {
      const snapshot = row.sourceSnapshot || row.targetSnapshot || null;
      const parentPathKey = snapshot?.parentPath?.trim() || null;
      const depth = Number.isFinite(snapshot?.hierarchyLevel as number)
        ? Math.max(0, Number(snapshot?.hierarchyLevel))
        : 0;
      const positionToken = snapshot?.position || snapshot?.findNumber || row.rowId;
      const assemblyPathToken = snapshot?.assemblyPath?.trim();
      const candidatePathKey = assemblyPathToken || `${parentPathKey || '/root'}/${positionToken}`;
      return {
        nodeId: row.rowId,
        parentNodeId: null as string | null,
        depth,
        hasChildren: false,
        rowId: row.rowId,
        changeType: row.changeType,
        keyFields: {
          partNumber: row.keyFields.partNumber,
          revision: row.keyFields.revision,
          description: row.keyFields.description
        },
        changedFields: row.rationale.changedFields,
        fromParent: row.rationale.fromParent || null,
        toParent: row.rationale.toParent || null,
        sortSourceIndex: row.sourceIndex,
        sortTargetIndex: row.targetIndex,
        parentPathKey,
        pathKey: candidatePathKey
      };
    });

    const pathToNodeId = new Map<string, string>();
    for (const row of treeRows) {
      if (!pathToNodeId.has(row.pathKey)) {
        pathToNodeId.set(row.pathKey, row.nodeId);
      }
    }

    for (const row of treeRows) {
      if (!row.parentPathKey) {
        row.parentNodeId = null;
        continue;
      }
      row.parentNodeId = pathToNodeId.get(row.parentPathKey) || null;
    }

    const childrenByParent = new Map<string | null, number>();
    for (const row of treeRows) {
      const key = row.parentNodeId || null;
      childrenByParent.set(key, (childrenByParent.get(key) || 0) + 1);
    }
    for (const row of treeRows) {
      row.hasChildren = (childrenByParent.get(row.nodeId) || 0) > 0;
    }

    return treeRows;
  }

  private buildVisibleTree(
    nodes: Array<
      DiffTreeNode & {
        sortSourceIndex: number;
        sortTargetIndex: number;
      }
    >,
    expandedNodeIds: Set<string>
  ): Array<
    DiffTreeNode & {
      sortSourceIndex: number;
      sortTargetIndex: number;
    }
  > {
    const childrenByParent = new Map<string | null, Array<(typeof nodes)[number]>>();
    for (const node of nodes) {
      const key = node.parentNodeId || null;
      const bucket = childrenByParent.get(key) || [];
      bucket.push(node);
      childrenByParent.set(key, bucket);
    }

    for (const bucket of childrenByParent.values()) {
      bucket.sort((a, b) => {
        if (a.sortSourceIndex !== b.sortSourceIndex) return a.sortSourceIndex - b.sortSourceIndex;
        if (a.sortTargetIndex !== b.sortTargetIndex) return a.sortTargetIndex - b.sortTargetIndex;
        return a.nodeId.localeCompare(b.nodeId);
      });
    }

    const rootNodes = [...(childrenByParent.get(null) || [])];
    const orphans = nodes.filter(
      (node) =>
        node.parentNodeId !== null && !nodes.some((candidate) => candidate.nodeId === node.parentNodeId)
    );
    for (const orphan of orphans) {
      if (!rootNodes.some((existing) => existing.nodeId === orphan.nodeId)) {
        rootNodes.push(orphan);
      }
    }
    rootNodes.sort((a, b) => {
      if (a.sortSourceIndex !== b.sortSourceIndex) return a.sortSourceIndex - b.sortSourceIndex;
      if (a.sortTargetIndex !== b.sortTargetIndex) return a.sortTargetIndex - b.sortTargetIndex;
      return a.nodeId.localeCompare(b.nodeId);
    });

    const visible: Array<(typeof nodes)[number]> = [];
    const walk = (node: (typeof nodes)[number]) => {
      visible.push(node);
      if (!expandedNodeIds.has(node.nodeId)) return;
      const children = childrenByParent.get(node.nodeId) || [];
      for (const child of children) {
        walk(child);
      }
    };

    for (const root of rootNodes) {
      walk(root);
    }

    return visible;
  }

  private applyRowsQuery(rows: PersistedDiffRow[], query?: DiffRowsQueryDescriptor): PersistedDiffRow[] {
    if (!query) return rows;
    const searchText = query.searchText?.trim().toLowerCase() || '';

    const filtered = rows.filter((row) => {
      if (searchText) {
        const haystack = this.rowSearchDocument(row).toLowerCase();
        if (!haystack.includes(searchText)) {
          return false;
        }
      }

      for (const filter of query.filters || []) {
        this.validateFilter(filter);
        const candidate = this.extractFieldValue(row, filter.field);
        if (!this.applyFilter(filter, candidate)) {
          return false;
        }
      }
      return true;
    });

    const sortBy = (query.sortBy || 'sourceIndex').trim();
    const sortDir = query.sortDir === 'desc' ? -1 : 1;
    this.validateField(sortBy);

    return [...filtered].sort((a, b) => {
      const aValue = this.extractFieldValue(a, sortBy);
      const bValue = this.extractFieldValue(b, sortBy);
      const compare = this.compareValues(aValue, bValue) * sortDir;
      if (compare !== 0) return compare;
      return a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex || a.rowId.localeCompare(b.rowId);
    });
  }

  private rowSearchDocument(row: PersistedDiffRow): string {
    const changedFields = row.rationale.changedFields.join(' ');
    const cells = row.cells
      .map((cell) => `${cell.field}:${cell.before ?? ''}->${cell.after ?? ''}`)
      .join(' ');
    return [
      row.rowId,
      row.changeType,
      row.keyFields.partNumber || '',
      row.keyFields.revision || '',
      row.keyFields.description || '',
      row.rationale.classificationReason || '',
      row.rationale.matchReason || '',
      row.rationale.fromParent || '',
      row.rationale.toParent || '',
      changedFields,
      cells
    ].join(' ');
  }

  private validateField(field: string): void {
    if (
      field === 'sourceIndex' ||
      field === 'targetIndex' ||
      field === 'changeType' ||
      field === 'partNumber' ||
      field === 'revision' ||
      field === 'description' ||
      field === 'classificationReason' ||
      field === 'matchReason'
    ) {
      return;
    }
    if (field.startsWith('keyFields.')) return;
    if (field.startsWith('rationale.')) return;
    if (field.startsWith('source.')) return;
    if (field.startsWith('target.')) return;
    throw new BadRequestException({
      code: 'DIFF_ROWS_QUERY_INVALID',
      message: `Unsupported field "${field}" in diff rows query.`
    });
  }

  private validateFilter(filter: DiffRowsQueryFilter): void {
    this.validateField(filter.field);
    const supportedOps = new Set(['eq', 'contains', 'gt', 'lt', 'in']);
    if (!supportedOps.has(filter.op)) {
      throw new BadRequestException({
        code: 'DIFF_ROWS_QUERY_INVALID',
        message: `Unsupported operator "${filter.op}" in diff rows query.`
      });
    }
  }

  private extractFieldValue(row: PersistedDiffRow, field: string): string | number | boolean | null {
    switch (field) {
      case 'sourceIndex':
        return row.sourceIndex;
      case 'targetIndex':
        return row.targetIndex;
      case 'changeType':
        return row.changeType;
      case 'partNumber':
        return row.keyFields.partNumber ?? null;
      case 'revision':
        return row.keyFields.revision ?? null;
      case 'description':
        return row.keyFields.description ?? null;
      case 'classificationReason':
        return row.rationale.classificationReason ?? null;
      case 'matchReason':
        return row.rationale.matchReason ?? null;
      default:
        break;
    }

    if (field.startsWith('keyFields.')) {
      const key = field.replace('keyFields.', '') as keyof PersistedDiffRow['keyFields'];
      return row.keyFields[key] ?? null;
    }
    if (field.startsWith('rationale.')) {
      const key = field.replace('rationale.', '');
      if (key === 'changedFields') return row.rationale.changedFields.join(',');
      return (row.rationale as Record<string, unknown>)[key] as string | number | boolean | null;
    }
    if (field.startsWith('source.')) {
      const key = field.replace('source.', '') as keyof DiffComparableRow;
      return (row.sourceSnapshot?.[key] ?? null) as string | number | boolean | null;
    }
    if (field.startsWith('target.')) {
      const key = field.replace('target.', '') as keyof DiffComparableRow;
      return (row.targetSnapshot?.[key] ?? null) as string | number | boolean | null;
    }
    return null;
  }

  private applyFilter(
    filter: DiffRowsQueryFilter,
    candidate: string | number | boolean | null
  ): boolean {
    const value = filter.value;
    if (filter.op === 'eq') {
      return String(candidate ?? '').toLowerCase() === String(value).toLowerCase();
    }
    if (filter.op === 'contains') {
      return String(candidate ?? '').toLowerCase().includes(String(value).toLowerCase());
    }
    if (filter.op === 'in') {
      const options = String(value)
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
      return options.includes(String(candidate ?? '').toLowerCase());
    }

    const candidateNum = Number(candidate);
    const valueNum = Number(value);
    if (!Number.isFinite(candidateNum) || !Number.isFinite(valueNum)) {
      return false;
    }
    if (filter.op === 'gt') return candidateNum > valueNum;
    if (filter.op === 'lt') return candidateNum < valueNum;
    return false;
  }

  private compareValues(
    a: string | number | boolean | null,
    b: string | number | boolean | null
  ): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;

    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  }

  private async ensureRevisionGraphSnapshot(
    tenantId: string,
    revisionId: string,
    rows: DiffComparableRow[]
  ): Promise<void> {
    const graphKey = `${tenantId}::${revisionId}`;
    if (this.graphSnapshots.has(graphKey)) return;

    if (this.databaseService.enabled) {
      const existing = await this.databaseService.client.partNode.findFirst({
        where: {
          tenantId,
          revisionId
        },
        select: { nodeId: true }
      });
      if (existing) {
        this.graphSnapshots.set(graphKey, { nodes: [], edges: [] });
        return;
      }
    }

    const createdAt = new Date();
    const nodes = rows.map<PartNode>((row) => ({
      nodeId: this.nodeIdForRow(revisionId, row.rowId),
      tenantId,
      revisionId,
      sourceRowId: row.rowId,
      partNumber: row.partNumber || null,
      revision: row.revision || null,
      description: row.description || null,
      internalId: row.internalId || null,
      hierarchyLevel: row.hierarchyLevel ?? null,
      assemblyPath: row.assemblyPath || null,
      createdAtUtc: createdAt.toISOString()
    }));

    const nodeIdentityMap = new Map<string, string>();
    rows.forEach((row, index) => {
      const nodeId = this.nodeIdForRow(revisionId, row.rowId);
      const identity =
        row.partNumber ||
        row.internalId ||
        row.description ||
        row.assemblyPath ||
        row.rowId;
      nodeIdentityMap.set(identity, nodeId);
      nodeIdentityMap.set(`IDX:${index + 1}`, nodeId);
      if (row.position) {
        nodeIdentityMap.set(`IDX:${row.position}`, nodeId);
      }
      if (row.findNumber) {
        nodeIdentityMap.set(`IDX:${row.findNumber}`, nodeId);
      }
    });

    const edges = rows.map<ContainsEdge>((row) => {
      const parentNodeId = row.parentPath ? nodeIdentityMap.get(row.parentPath) || null : null;
      return {
        edgeId: `${revisionId}:${row.rowId}:edge`,
        tenantId,
        revisionId,
        parentNodeId,
        childNodeId: this.nodeIdForRow(revisionId, row.rowId),
        sourceRowId: row.rowId,
        quantity: row.quantity ?? null,
        findNumber: row.findNumber || row.position || null,
        parentPath: row.parentPath || null,
        depth: row.hierarchyLevel ?? null,
        createdAtUtc: createdAt.toISOString()
      };
    });

    this.graphSnapshots.set(graphKey, { nodes, edges });

    if (!this.databaseService.enabled) return;

    try {
      for (const nodeBatch of this.chunkArray(nodes, 200)) {
        await this.databaseService.client.partNode.createMany({
          data: nodeBatch.map((node) => ({
            ...node,
            createdAtUtc: new Date(node.createdAtUtc)
          }))
        });
      }

      for (const edgeBatch of this.chunkArray(edges, 200)) {
        await this.databaseService.client.containsEdge.createMany({
          data: edgeBatch.map((edge) => ({
            ...edge,
            createdAtUtc: new Date(edge.createdAtUtc)
          }))
        });
      }
    } catch (error) {
      const prismaCode = (error as { code?: string } | null)?.code;
      if (prismaCode === 'P2002') {
        // Snapshot already exists from a concurrent run; treat as idempotent success.
        return;
      }
      throw error;
    }
  }

  private nodeIdForRow(revisionId: string, rowId: string): string {
    return createHash('sha256').update(`${revisionId}::${rowId}`).digest('hex').slice(0, 64);
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
  }

  private emitMetricEvent(
    job: Pick<DiffJobRecord, 'jobId' | 'tenantId' | 'requestedBy'>,
    metricName: string,
    details: Record<string, unknown>
  ): void {
    const payload = {
      metricName,
      jobId: job.jobId,
      tenantId: job.tenantId,
      details,
      emittedAtUtc: new Date().toISOString()
    };
    this.logger.log(JSON.stringify(payload));

    if (!this.databaseService.enabled) return;
    void this.databaseService.client.uploadEvent
      .create({
        data: {
          eventId: randomUUID(),
          tenantId: job.tenantId,
          userKey: job.requestedBy,
          eventType: metricName,
          correlationId: job.jobId,
          detailsJson: JSON.stringify(details),
          createdAtUtc: new Date()
        }
      })
      .catch(() => {
        // Best-effort metric persistence; structured log already emitted.
      });
  }

  private defaultSourceRows(): DiffComparableRow[] {
    return [
      {
        rowId: 's-001',
        internalId: 'INT-001',
        partNumber: 'PN-100',
        revision: 'A',
        description: 'Bracket',
        quantity: 2,
        supplier: 'Acme',
        parentPath: '/root',
        position: '10'
      },
      {
        rowId: 's-002',
        internalId: 'INT-002',
        partNumber: 'PN-200',
        revision: 'A',
        description: 'Screw',
        quantity: 10,
        supplier: 'BoltCo',
        parentPath: '/root',
        position: '20'
      },
      {
        rowId: 's-003',
        internalId: 'INT-003',
        partNumber: 'PN-300',
        revision: 'A',
        description: 'Plate',
        quantity: 1,
        supplier: 'Acme',
        parentPath: '/left',
        position: '30'
      },
      {
        rowId: 's-004',
        internalId: 'INT-004',
        partNumber: 'PN-400',
        revision: 'A',
        description: 'Motor',
        quantity: 1,
        supplier: 'Drive',
        parentPath: '/root',
        position: '40'
      },
      {
        rowId: 's-005',
        internalId: 'INT-005',
        partNumber: 'PN-500',
        revision: 'A',
        description: 'Switch',
        quantity: 1,
        supplier: 'Electra',
        parentPath: '/ctrl',
        position: '50'
      }
    ];
  }

  private defaultTargetRows(): DiffComparableRow[] {
    return [
      {
        rowId: 't-001',
        internalId: 'INT-001',
        partNumber: 'PN-100',
        revision: 'A',
        description: 'Bracket',
        quantity: 2,
        supplier: 'Acme',
        parentPath: '/root',
        position: '10'
      },
      {
        rowId: 't-002',
        internalId: 'INT-002',
        partNumber: 'PN-200',
        revision: 'A',
        description: 'Screw',
        quantity: 12,
        supplier: 'BoltCo',
        parentPath: '/root',
        position: '20'
      },
      {
        rowId: 't-003',
        internalId: 'INT-003',
        partNumber: 'PN-300',
        revision: 'A',
        description: 'Plate',
        quantity: 1,
        supplier: 'Acme',
        parentPath: '/right',
        position: '30'
      },
      {
        rowId: 't-006',
        internalId: 'INT-006',
        partNumber: 'PN-600',
        revision: 'A',
        description: 'Cover',
        quantity: 1,
        supplier: 'Acme',
        parentPath: '/root',
        position: '60'
      },
      {
        rowId: 't-005',
        internalId: 'INT-007',
        partNumber: 'PN-501',
        revision: 'A',
        description: 'Switch',
        quantity: 1,
        supplier: 'Electra',
        parentPath: '/ctrl',
        position: '50'
      }
    ];
  }
}
