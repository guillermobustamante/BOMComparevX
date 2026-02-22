import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { UploadRevisionService } from '../uploads/upload-revision.service';
import {
  DIFF_CONTRACT_VERSION,
  DiffComparableRow,
  DiffJobCounters,
  DiffJobStatusPayload,
  PersistedDiffRow
} from './diff-contract';
import { DiffComputationService } from './diff-computation.service';

interface DiffJobRecord {
  jobId: string;
  tenantId: string;
  requestedBy: string;
  createdAtUtc: string;
  startedAtMs: number;
  computeDurationMs: number;
  contractVersion: string;
  rows: PersistedDiffRow[];
  counters: DiffJobCounters;
  firstStatusLatencyMs?: number;
  firstRowsLatencyMs?: number;
  completionLatencyMs?: number;
  completionMetricEmitted: boolean;
}

@Injectable()
export class DiffJobService {
  constructor(
    private readonly diffComputationService: DiffComputationService,
    private readonly databaseService: DatabaseService,
    private readonly uploadRevisionService: UploadRevisionService
  ) {}

  private readonly logger = new Logger(DiffJobService.name);
  private readonly jobs = new Map<string, DiffJobRecord>();

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
    const computed = this.diffComputationService.compute({ sourceRows, targetRows });
    const computeDurationMs = Date.now() - startedAtMs;

    const jobId = randomUUID();
    const createdAtUtc = new Date().toISOString();
    const record: DiffJobRecord = {
      jobId,
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      createdAtUtc,
      startedAtMs,
      computeDurationMs,
      contractVersion: computed.contractVersion,
      rows: computed.rows,
      counters: computed.counters,
      completionMetricEmitted: false
    };
    this.jobs.set(jobId, record);
    this.emitMetricEvent(record, 'stage4.diff.compute', {
      computeDurationMs,
      sourceRows: sourceRows.length,
      targetRows: targetRows.length
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
            counters: record.counters,
            totalRows: record.rows.length,
            computeDurationMs
          }),
          createdAtUtc: new Date(createdAtUtc)
        }
      });
    }

    return this.getStatus(jobId, input.tenantId);
  }

  getStatus(jobId: string, tenantId: string): DiffJobStatusPayload {
    const job = this.requireTenantJob(jobId, tenantId);
    const progress = this.progress(job);
    if (job.firstStatusLatencyMs === undefined) {
      job.firstStatusLatencyMs = Date.now() - job.startedAtMs;
      this.emitMetricEvent(job, 'stage4.diff.first_status', {
        firstStatusLatencyMs: job.firstStatusLatencyMs
      });
    }
    if (progress.status === 'completed' && !job.completionMetricEmitted) {
      job.completionLatencyMs = Date.now() - job.startedAtMs;
      job.completionMetricEmitted = true;
      this.emitMetricEvent(job, 'stage4.diff.completed', {
        completionLatencyMs: job.completionLatencyMs,
        totalRows: job.rows.length,
        counters: job.counters
      });
    }
    const nextCursor = progress.loadedRows < job.rows.length ? String(progress.loadedRows) : null;

    return {
      contractVersion: job.contractVersion,
      jobId: job.jobId,
      phase: progress.phase,
      percentComplete: progress.percentComplete,
      counters: job.counters,
      loadedRows: progress.loadedRows,
      totalRows: job.rows.length,
      nextCursor,
      status: progress.status
    };
  }

  getRows(
    jobId: string,
    tenantId: string,
    cursor: string | undefined,
    limit: number
  ): {
    contractVersion: string;
    jobId: string;
    rows: PersistedDiffRow[];
    nextCursor: string | null;
    loadedRows: number;
    totalRows: number;
  } {
    const job = this.requireTenantJob(jobId, tenantId);
    const progress = this.progress(job);
    if (job.firstRowsLatencyMs === undefined && progress.loadedRows > 0) {
      job.firstRowsLatencyMs = Date.now() - job.startedAtMs;
      this.emitMetricEvent(job, 'stage4.diff.first_rows', {
        firstRowsLatencyMs: job.firstRowsLatencyMs
      });
    }

    const availableRows = progress.loadedRows;
    const start = this.parseCursor(cursor);
    const boundedLimit = Math.min(Math.max(limit || 50, 1), 200);
    const end = Math.min(start + boundedLimit, availableRows);
    const rows = job.rows.slice(start, end);
    const nextCursor = end < availableRows ? String(end) : null;

    return {
      contractVersion: DIFF_CONTRACT_VERSION,
      jobId,
      rows,
      nextCursor,
      loadedRows: availableRows,
      totalRows: job.rows.length
    };
  }

  getRowsForExport(
    jobId: string,
    tenantId: string,
    requestedBy: string
  ): {
    contractVersion: string;
    jobId: string;
    rows: PersistedDiffRow[];
    counters: DiffJobCounters;
  } {
    const job = this.requireTenantJob(jobId, tenantId);
    if (job.requestedBy !== requestedBy) {
      throw new ForbiddenException({
        code: 'EXPORT_ACCESS_DENIED',
        message: 'Access to this comparison export is not allowed.',
        correlationId: randomUUID()
      });
    }

    return {
      contractVersion: job.contractVersion,
      jobId: job.jobId,
      rows: job.rows,
      counters: job.counters
    };
  }

  private requireTenantJob(jobId: string, tenantId: string): DiffJobRecord {
    const job = this.jobs.get(jobId);
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
    percentComplete: number;
    phase: 'matching' | 'classifying' | 'finalizing' | 'completed';
    status: 'running' | 'completed';
  } {
    const totalRows = job.rows.length;
    if (totalRows === 0) {
      return { loadedRows: 0, percentComplete: 100, phase: 'completed', status: 'completed' };
    }

    const elapsedMs = Date.now() - new Date(job.createdAtUtc).getTime();
    // Scale chunk cadence by job size to avoid sluggish progressive delivery on larger datasets.
    const rowsPerStep = Math.max(6, Math.min(150, Math.ceil(totalRows / 25)));
    const steps = Math.floor(elapsedMs / 600) + 1;
    const loadedRows = Math.min(totalRows, steps * rowsPerStep);
    const ratio = loadedRows / totalRows;
    const percentComplete = Math.min(100, Math.max(5, Math.round(ratio * 100)));
    const phase =
      ratio >= 1
        ? 'completed'
        : ratio >= 0.66
          ? 'finalizing'
          : ratio >= 0.33
            ? 'classifying'
            : 'matching';

    return {
      loadedRows,
      percentComplete,
      phase,
      status: ratio >= 1 ? 'completed' : 'running'
    };
  }

  private parseCursor(cursor: string | undefined): number {
    if (!cursor) return 0;
    const parsed = Number(cursor);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
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
