import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AcceptedUploadJob } from './upload-job.service';

export interface UploadHistoryEntry {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  tagLabel: string | null;
  deletedAtUtc: string | null;
  deletedBy: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  status: 'queued';
  initiatorEmail: string;
  tenantId: string;
}

@Injectable()
export class UploadHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly historyById = new Map<string, UploadHistoryEntry>();
  private readonly historyByJobId = new Map<string, UploadHistoryEntry>();

  async createAcceptedUploadEntry(job: AcceptedUploadJob): Promise<UploadHistoryEntry> {
    const now = new Date().toISOString();
    const entry: UploadHistoryEntry = {
      historyId: randomUUID(),
      jobId: job.jobId,
      sessionId: job.sessionId,
      sessionName: null,
      tagLabel: null,
      deletedAtUtc: null,
      deletedBy: null,
      createdAtUtc: now,
      updatedAtUtc: now,
      status: 'queued',
      initiatorEmail: job.requestedBy,
      tenantId: job.tenantId
    };
    this.historyById.set(entry.historyId, entry);
    this.historyByJobId.set(entry.jobId, entry);

    if (this.databaseService.enabled) {
      await this.databaseService.client.historyEntry.create({
        data: {
          historyId: entry.historyId,
          jobId: entry.jobId,
          sessionId: entry.sessionId,
          sessionName: entry.sessionName,
          tagLabel: entry.tagLabel,
          createdAtUtc: new Date(entry.createdAtUtc),
          updatedAtUtc: new Date(entry.updatedAtUtc),
          deletedAtUtc: null,
          deletedBy: null,
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
        sessionName: row.sessionName || null,
        tagLabel: row.tagLabel || null,
        deletedAtUtc: row.deletedAtUtc ? row.deletedAtUtc.toISOString() : null,
        deletedBy: row.deletedBy || null,
        createdAtUtc: row.createdAtUtc.toISOString(),
        updatedAtUtc: row.updatedAtUtc.toISOString(),
        status: 'queued',
        initiatorEmail: row.initiatorEmail,
        tenantId: row.tenantId
      };
      this.historyById.set(mapped.historyId, mapped);
      this.historyByJobId.set(mapped.jobId, mapped);
      return mapped;
    }
    return this.historyByJobId.get(jobId) || null;
  }

  async listByUser(
    tenantId: string,
    initiatorEmail: string,
    sessionId?: string
  ): Promise<UploadHistoryEntry[]> {
    if (this.databaseService.enabled) {
      const rows = await this.databaseService.client.historyEntry.findMany({
        where: {
          tenantId,
          initiatorEmail,
          ...(sessionId ? { sessionId } : {}),
          deletedAtUtc: null
        },
        orderBy: {
          createdAtUtc: 'desc'
        }
      });
      return rows.map((row: Parameters<typeof this.mapRow>[0]) => this.mapRow(row));
    }

    return [...this.historyById.values()]
      .filter(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.initiatorEmail === initiatorEmail &&
          (!sessionId || entry.sessionId === sessionId) &&
          !entry.deletedAtUtc
      )
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  }

  async renameSession(
    tenantId: string,
    initiatorEmail: string,
    historyId: string,
    sessionName: string
  ): Promise<UploadHistoryEntry | null> {
    const trimmed = sessionName.trim();
    if (this.databaseService.enabled) {
      const existing = await this.databaseService.client.historyEntry.findFirst({
        where: {
          historyId,
          tenantId,
          initiatorEmail,
          deletedAtUtc: null
        }
      });
      if (!existing) return null;
      const updated = await this.databaseService.client.historyEntry.update({
        where: { historyId },
        data: {
          sessionName: trimmed || null,
          updatedAtUtc: new Date()
        }
      });
      const mapped = this.mapRow(updated);
      this.historyById.set(mapped.historyId, mapped);
      this.historyByJobId.set(mapped.jobId, mapped);
      return mapped;
    }

    const existing = this.historyById.get(historyId);
    if (!existing) return null;
    if (
      existing.tenantId !== tenantId ||
      existing.initiatorEmail !== initiatorEmail ||
      !!existing.deletedAtUtc
    ) {
      return null;
    }
    const updated: UploadHistoryEntry = {
      ...existing,
      sessionName: trimmed || null,
      updatedAtUtc: new Date().toISOString()
    };
    this.historyById.set(updated.historyId, updated);
    this.historyByJobId.set(updated.jobId, updated);
    return updated;
  }

  async updateTag(
    tenantId: string,
    initiatorEmail: string,
    historyId: string,
    tagLabel: string
  ): Promise<UploadHistoryEntry | null> {
    const trimmed = tagLabel.trim();
    if (this.databaseService.enabled) {
      const existing = await this.databaseService.client.historyEntry.findFirst({
        where: {
          historyId,
          tenantId,
          initiatorEmail,
          deletedAtUtc: null
        }
      });
      if (!existing) return null;
      const updated = await this.databaseService.client.historyEntry.update({
        where: { historyId },
        data: {
          tagLabel: trimmed || null,
          updatedAtUtc: new Date()
        }
      });
      const mapped = this.mapRow(updated);
      this.historyById.set(mapped.historyId, mapped);
      this.historyByJobId.set(mapped.jobId, mapped);
      return mapped;
    }

    const existing = this.historyById.get(historyId);
    if (!existing) return null;
    if (
      existing.tenantId !== tenantId ||
      existing.initiatorEmail !== initiatorEmail ||
      !!existing.deletedAtUtc
    ) {
      return null;
    }
    const updated: UploadHistoryEntry = {
      ...existing,
      tagLabel: trimmed || null,
      updatedAtUtc: new Date().toISOString()
    };
    this.historyById.set(updated.historyId, updated);
    this.historyByJobId.set(updated.jobId, updated);
    return updated;
  }

  async softDelete(
    tenantId: string,
    initiatorEmail: string,
    historyId: string
  ): Promise<boolean> {
    const deletedAt = new Date();
    if (this.databaseService.enabled) {
      const existing = await this.databaseService.client.historyEntry.findFirst({
        where: {
          historyId,
          tenantId,
          initiatorEmail,
          deletedAtUtc: null
        }
      });
      if (!existing) return false;
      await this.databaseService.client.historyEntry.update({
        where: { historyId },
        data: {
          deletedAtUtc: deletedAt,
          deletedBy: initiatorEmail,
          updatedAtUtc: deletedAt
        }
      });
      const inMemory = this.historyById.get(historyId);
      if (inMemory) {
        const updated = {
          ...inMemory,
          deletedAtUtc: deletedAt.toISOString(),
          deletedBy: initiatorEmail,
          updatedAtUtc: deletedAt.toISOString()
        };
        this.historyById.set(historyId, updated);
        this.historyByJobId.set(updated.jobId, updated);
      }
      return true;
    }

    const existing = this.historyById.get(historyId);
    if (!existing) return false;
    if (
      existing.tenantId !== tenantId ||
      existing.initiatorEmail !== initiatorEmail ||
      !!existing.deletedAtUtc
    ) {
      return false;
    }
    const updated: UploadHistoryEntry = {
      ...existing,
      deletedAtUtc: deletedAt.toISOString(),
      deletedBy: initiatorEmail,
      updatedAtUtc: deletedAt.toISOString()
    };
    this.historyById.set(historyId, updated);
    this.historyByJobId.set(updated.jobId, updated);
    return true;
  }

  private mapRow(row: {
    historyId: string;
    jobId: string;
    sessionId: string;
    sessionName: string | null;
    tagLabel: string | null;
    deletedAtUtc: Date | null;
    deletedBy: string | null;
    createdAtUtc: Date;
    updatedAtUtc: Date;
    status: string;
    initiatorEmail: string;
    tenantId: string;
  }): UploadHistoryEntry {
    return {
      historyId: row.historyId,
      jobId: row.jobId,
      sessionId: row.sessionId,
      sessionName: row.sessionName || null,
      tagLabel: row.tagLabel || null,
      deletedAtUtc: row.deletedAtUtc ? row.deletedAtUtc.toISOString() : null,
      deletedBy: row.deletedBy || null,
      createdAtUtc: row.createdAtUtc.toISOString(),
      updatedAtUtc: row.updatedAtUtc.toISOString(),
      status: 'queued',
      initiatorEmail: row.initiatorEmail,
      tenantId: row.tenantId
    };
  }
}
