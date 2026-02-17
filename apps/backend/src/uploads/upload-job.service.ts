import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export interface AcceptedUploadJob {
  jobId: string;
  sessionId: string;
  status: 'accepted' | 'queued';
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  createdAtUtc: string;
  idempotencyKey?: string;
  files: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
  };
  policy: {
    comparisonsUsed: number;
    unrestrictedComparisonsRemaining: number;
    cooldownUntilUtc: string | null;
  };
}

@Injectable()
export class UploadJobService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly jobsById = new Map<string, AcceptedUploadJob>();
  private readonly jobsByUserIdempotency = new Map<string, AcceptedUploadJob>();

  async findByIdempotency(userKey: string, idempotencyKey: string): Promise<AcceptedUploadJob | null> {
    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.jobRun.findFirst({
        where: {
          requestedBy: userKey,
          idempotencyKey
        }
      });
      if (!row) return null;
      const mapped = this.fromRow(row);
      this.jobsById.set(mapped.jobId, mapped);
      this.jobsByUserIdempotency.set(this.idempotencyMapKey(userKey, idempotencyKey), mapped);
      return mapped;
    }
    return this.jobsByUserIdempotency.get(this.idempotencyMapKey(userKey, idempotencyKey)) || null;
  }

  async createAcceptedJob(input: {
    tenantId: string;
    requestedBy: string;
    idempotencyKey?: string;
    files: AcceptedUploadJob['files'];
    policy: AcceptedUploadJob['policy'];
  }): Promise<AcceptedUploadJob> {
    const job: AcceptedUploadJob = {
      jobId: randomUUID(),
      sessionId: randomUUID(),
      status: 'accepted',
      correlationId: randomUUID(),
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      createdAtUtc: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
      files: input.files,
      policy: input.policy
    };

    this.jobsById.set(job.jobId, job);
    if (input.idempotencyKey) {
      this.jobsByUserIdempotency.set(this.idempotencyMapKey(input.requestedBy, input.idempotencyKey), job);
    }

    if (this.databaseService.enabled) {
      await this.databaseService.client.jobRun.create({
        data: {
          jobId: job.jobId,
          sessionId: job.sessionId,
          status: job.status,
          correlationId: job.correlationId,
          tenantId: job.tenantId,
          requestedBy: job.requestedBy,
          createdAtUtc: new Date(job.createdAtUtc),
          idempotencyKey: job.idempotencyKey,
          fileAName: job.files.fileA.name,
          fileASize: job.files.fileA.size,
          fileBName: job.files.fileB.name,
          fileBSize: job.files.fileB.size,
          policyComparisonsUsed: job.policy.comparisonsUsed,
          policyUnrestrictedComparisonsRemaining: job.policy.unrestrictedComparisonsRemaining,
          policyCooldownUntilUtc: job.policy.cooldownUntilUtc ? new Date(job.policy.cooldownUntilUtc) : null
        }
      });
    }

    return job;
  }

  totalJobs(): number {
    return this.jobsById.size;
  }

  async markQueued(jobId: string): Promise<AcceptedUploadJob | null> {
    let current = this.jobsById.get(jobId);
    if (!current && this.databaseService.enabled) {
      const row = await this.databaseService.client.jobRun.findUnique({ where: { jobId } });
      if (row) {
        current = this.fromRow(row);
        this.jobsById.set(current.jobId, current);
      }
    }
    if (!current) return null;

    current.status = 'queued';
    this.jobsById.set(jobId, current);

    if (this.databaseService.enabled) {
      await this.databaseService.client.jobRun.update({
        where: { jobId },
        data: { status: 'queued' }
      });
    }

    return current;
  }

  async findByJobId(jobId: string): Promise<AcceptedUploadJob | null> {
    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.jobRun.findUnique({ where: { jobId } });
      if (!row) return null;
      const mapped = this.fromRow(row);
      this.jobsById.set(mapped.jobId, mapped);
      return mapped;
    }
    return this.jobsById.get(jobId) || null;
  }

  private idempotencyMapKey(userKey: string, idempotencyKey: string): string {
    return `${userKey}::${idempotencyKey}`;
  }

  private fromRow(row: {
    jobId: string;
    sessionId: string;
    status: string;
    correlationId: string;
    tenantId: string;
    requestedBy: string;
    createdAtUtc: Date;
    idempotencyKey: string | null;
    fileAName: string;
    fileASize: number;
    fileBName: string;
    fileBSize: number;
    policyComparisonsUsed: number;
    policyUnrestrictedComparisonsRemaining: number;
    policyCooldownUntilUtc: Date | null;
  }): AcceptedUploadJob {
    return {
      jobId: row.jobId,
      sessionId: row.sessionId,
      status: row.status === 'queued' ? 'queued' : 'accepted',
      correlationId: row.correlationId,
      tenantId: row.tenantId,
      requestedBy: row.requestedBy,
      createdAtUtc: row.createdAtUtc.toISOString(),
      idempotencyKey: row.idempotencyKey || undefined,
      files: {
        fileA: { name: row.fileAName, size: row.fileASize },
        fileB: { name: row.fileBName, size: row.fileBSize }
      },
      policy: {
        comparisonsUsed: row.policyComparisonsUsed,
        unrestrictedComparisonsRemaining: row.policyUnrestrictedComparisonsRemaining,
        cooldownUntilUtc: row.policyCooldownUntilUtc ? row.policyCooldownUntilUtc.toISOString() : null
      }
    };
  }
}
