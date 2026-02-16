import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

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
  private readonly jobsById = new Map<string, AcceptedUploadJob>();
  private readonly jobsByUserIdempotency = new Map<string, AcceptedUploadJob>();

  findByIdempotency(userKey: string, idempotencyKey: string): AcceptedUploadJob | null {
    return this.jobsByUserIdempotency.get(this.idempotencyMapKey(userKey, idempotencyKey)) || null;
  }

  createAcceptedJob(input: {
    tenantId: string;
    requestedBy: string;
    idempotencyKey?: string;
    files: AcceptedUploadJob['files'];
    policy: AcceptedUploadJob['policy'];
  }): AcceptedUploadJob {
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

    return job;
  }

  totalJobs(): number {
    return this.jobsById.size;
  }

  markQueued(jobId: string): AcceptedUploadJob | null {
    const current = this.jobsById.get(jobId);
    if (!current) return null;
    current.status = 'queued';
    this.jobsById.set(jobId, current);
    return current;
  }

  findByJobId(jobId: string): AcceptedUploadJob | null {
    return this.jobsById.get(jobId) || null;
  }

  private idempotencyMapKey(userKey: string, idempotencyKey: string): string {
    return `${userKey}::${idempotencyKey}`;
  }
}
