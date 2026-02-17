import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
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
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly historyById = new Map<string, UploadHistoryEntry>();
  private readonly historyByJobId = new Map<string, UploadHistoryEntry>();

  async createAcceptedUploadEntry(job: AcceptedUploadJob): Promise<UploadHistoryEntry> {
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

    if (this.databaseService.enabled) {
      await this.databaseService.client.historyEntry.create({
        data: {
          historyId: entry.historyId,
          jobId: entry.jobId,
          sessionId: entry.sessionId,
          createdAtUtc: new Date(entry.createdAtUtc),
          status: entry.status,
          initiatorEmail: entry.initiatorEmail,
          tenantId: job.tenantId
        }
      });
    }

    return entry;
  }

  async findByJobId(jobId: string, tenantId?: string): Promise<UploadHistoryEntry | null> {
    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.historyEntry.findFirst({
        where: {
          jobId,
          ...(tenantId ? { tenantId } : {})
        }
      });
      if (!row) return null;
      const mapped: UploadHistoryEntry = {
        historyId: row.historyId,
        jobId: row.jobId,
        sessionId: row.sessionId,
        createdAtUtc: row.createdAtUtc.toISOString(),
        status: 'queued',
        initiatorEmail: row.initiatorEmail
      };
      this.historyById.set(mapped.historyId, mapped);
      this.historyByJobId.set(mapped.jobId, mapped);
      return mapped;
    }
    return this.historyByJobId.get(jobId) || null;
  }
}
