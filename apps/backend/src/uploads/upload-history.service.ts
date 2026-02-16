import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AcceptedUploadJob } from './upload-job.service';

export interface UploadHistoryEntry {
  historyId: string;
  jobId: string;
  sessionId: string;
  createdAtUtc: string;
  status: 'queued';
  initiatorEmail: string;
}

@Injectable()
export class UploadHistoryService {
  private readonly historyById = new Map<string, UploadHistoryEntry>();
  private readonly historyByJobId = new Map<string, UploadHistoryEntry>();

  createAcceptedUploadEntry(job: AcceptedUploadJob): UploadHistoryEntry {
    const entry: UploadHistoryEntry = {
      historyId: randomUUID(),
      jobId: job.jobId,
      sessionId: job.sessionId,
      createdAtUtc: new Date().toISOString(),
      status: 'queued',
      initiatorEmail: job.requestedBy
    };
    this.historyById.set(entry.historyId, entry);
    this.historyByJobId.set(entry.jobId, entry);
    return entry;
  }

  findByJobId(jobId: string): UploadHistoryEntry | null {
    return this.historyByJobId.get(jobId) || null;
  }
}
