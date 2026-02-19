import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
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
  contractVersion: string;
  rows: PersistedDiffRow[];
  counters: DiffJobCounters;
}

@Injectable()
export class DiffJobService {
  constructor(
    private readonly diffComputationService: DiffComputationService,
    private readonly databaseService: DatabaseService
  ) {}

  private readonly jobs = new Map<string, DiffJobRecord>();

  async startJob(input: {
    tenantId: string;
    requestedBy: string;
    sourceRows?: DiffComparableRow[];
    targetRows?: DiffComparableRow[];
  }): Promise<DiffJobStatusPayload> {
    const sourceRows = input.sourceRows?.length ? input.sourceRows : this.defaultSourceRows();
    const targetRows = input.targetRows?.length ? input.targetRows : this.defaultTargetRows();
    const computed = this.diffComputationService.compute({ sourceRows, targetRows });

    const jobId = randomUUID();
    const createdAtUtc = new Date().toISOString();
    const record: DiffJobRecord = {
      jobId,
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      createdAtUtc,
      contractVersion: computed.contractVersion,
      rows: computed.rows,
      counters: computed.counters
    };
    this.jobs.set(jobId, record);

    if (this.databaseService.enabled) {
      // Reuse uploadEvents as a durable JSON event sink in V1 baseline.
      await this.databaseService.client.uploadEvent.create({
        data: {
          eventId: randomUUID(),
          tenantId: input.tenantId,
          userKey: input.requestedBy,
          eventType: 'diff.job.created',
          correlationId: jobId,
          detailsJson: JSON.stringify({
            counters: record.counters,
            totalRows: record.rows.length
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
      status: progress.loadedRows >= job.rows.length ? 'completed' : 'running'
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
  } {
    const totalRows = job.rows.length;
    if (totalRows === 0) {
      return { loadedRows: 0, percentComplete: 100, phase: 'completed' };
    }

    const elapsedMs = Date.now() - new Date(job.createdAtUtc).getTime();
    const rowsPerStep = 3;
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

    return { loadedRows, percentComplete, phase };
  }

  private parseCursor(cursor: string | undefined): number {
    if (!cursor) return 0;
    const parsed = Number(cursor);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  private defaultSourceRows(): DiffComparableRow[] {
    return [
      { rowId: 's-001', internalId: 'INT-001', partNumber: 'PN-100', revision: 'A', description: 'Bracket', quantity: 2, supplier: 'Acme', parentPath: '/root', position: '10' },
      { rowId: 's-002', internalId: 'INT-002', partNumber: 'PN-200', revision: 'A', description: 'Screw', quantity: 10, supplier: 'BoltCo', parentPath: '/root', position: '20' },
      { rowId: 's-003', internalId: 'INT-003', partNumber: 'PN-300', revision: 'A', description: 'Plate', quantity: 1, supplier: 'Acme', parentPath: '/left', position: '30' },
      { rowId: 's-004', internalId: 'INT-004', partNumber: 'PN-400', revision: 'A', description: 'Motor', quantity: 1, supplier: 'Drive', parentPath: '/root', position: '40' },
      { rowId: 's-005', internalId: 'INT-005', partNumber: 'PN-500', revision: 'A', description: 'Switch', quantity: 1, supplier: 'Electra', parentPath: '/ctrl', position: '50' }
    ];
  }

  private defaultTargetRows(): DiffComparableRow[] {
    return [
      { rowId: 't-001', internalId: 'INT-001', partNumber: 'PN-100', revision: 'A', description: 'Bracket', quantity: 2, supplier: 'Acme', parentPath: '/root', position: '10' },
      { rowId: 't-002', internalId: 'INT-002', partNumber: 'PN-200', revision: 'A', description: 'Screw', quantity: 12, supplier: 'BoltCo', parentPath: '/root', position: '20' },
      { rowId: 't-003', internalId: 'INT-003', partNumber: 'PN-300', revision: 'A', description: 'Plate', quantity: 1, supplier: 'Acme', parentPath: '/right', position: '30' },
      { rowId: 't-006', internalId: 'INT-006', partNumber: 'PN-600', revision: 'A', description: 'Cover', quantity: 1, supplier: 'Acme', parentPath: '/root', position: '60' },
      { rowId: 't-005', internalId: 'INT-007', partNumber: 'PN-501', revision: 'A', description: 'Switch', quantity: 1, supplier: 'Electra', parentPath: '/ctrl', position: '50' }
    ];
  }
}
