import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AcceptedUploadJob } from './upload-job.service';
import { UploadJobService } from './upload-job.service';

export interface QueuedUploadMessage {
  messageId: string;
  enqueuedAtUtc: string;
  jobId: string;
  sessionId: string;
  tenantId: string;
  requestedBy: string;
  correlationId: string;
  fileRefs: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
  };
  attempts: number;
}

interface DeadLetterUploadMessage extends QueuedUploadMessage {
  failedAtUtc: string;
  failureReason: string;
}

export interface QueueProcessResult {
  queued: boolean;
  deadLettered: boolean;
  attempts: number;
}

@Injectable()
export class UploadQueueService {
  private readonly messages: QueuedUploadMessage[] = [];
  private readonly deadLetters: DeadLetterUploadMessage[] = [];

  enqueueAcceptedJob(job: AcceptedUploadJob): QueuedUploadMessage {
    const message: QueuedUploadMessage = {
      messageId: randomUUID(),
      enqueuedAtUtc: new Date().toISOString(),
      jobId: job.jobId,
      sessionId: job.sessionId,
      tenantId: job.tenantId,
      requestedBy: job.requestedBy,
      correlationId: job.correlationId,
      fileRefs: job.files,
      attempts: 0
    };
    this.messages.push(message);
    return message;
  }

  async processAcceptedJobWithRetry(
    message: QueuedUploadMessage,
    uploadJobService: UploadJobService,
    options?: { forceFailure?: boolean; maxRetries?: number }
  ): Promise<QueueProcessResult> {
    const maxRetries = options?.maxRetries ?? 2;
    let attempts = 0;
    let lastError = 'unknown_queue_error';

    while (attempts <= maxRetries) {
      attempts += 1;
      try {
        if (options?.forceFailure) {
          throw new Error('forced_queue_failure');
        }
        await uploadJobService.markQueued(message.jobId);
        return {
          queued: true,
          deadLettered: false,
          attempts
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'queue_processing_error';
      }
    }

    this.deadLetters.push({
      ...message,
      attempts,
      failedAtUtc: new Date().toISOString(),
      failureReason: lastError
    });
    return {
      queued: false,
      deadLettered: true,
      attempts
    };
  }

  size(): number {
    return this.messages.length;
  }

  deadLetterSize(): number {
    return this.deadLetters.length;
  }
}
