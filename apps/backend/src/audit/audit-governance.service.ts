import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AuditLogRecord, AuditService } from './audit.service';

export interface AuditArchiveRunRecord {
  archiveId: string;
  tenantId: string;
  archiveDateUtc: string;
  triggeredAtUtc: string;
  triggeredBy: string;
  storageTarget: 'local' | 'azure_blob_grs';
  artifactUri: string;
  manifestUri: string;
  appendOnly: true;
  recordCount: number;
  payloadBytes: number;
  sha256: string;
  retentionYears: number;
}

@Injectable()
export class AuditGovernanceService {
  constructor(private readonly auditService: AuditService) {}

  async exportTenantAudit(input: {
    tenantId: string;
    format: 'csv' | 'ndjson';
    fromUtcIso?: string;
    toUtcIso?: string;
    actionType?: string;
    outcome?: string;
    actorEmail?: string;
    limit?: number;
  }): Promise<{
    fileName: string;
    contentType: string;
    content: string;
    rowCount: number;
  }> {
    const events = await this.auditService.listTenantEvents({
      tenantId: input.tenantId,
      fromUtcIso: input.fromUtcIso,
      toUtcIso: input.toUtcIso,
      actionType: input.actionType,
      outcome: input.outcome,
      actorEmail: input.actorEmail,
      limit: input.limit
    });

    const nowToken = this.timestampToken(new Date().toISOString());
    if (input.format === 'ndjson') {
      return {
        fileName: `audit_${this.safe(input.tenantId)}_${nowToken}.ndjson`,
        contentType: 'application/x-ndjson; charset=utf-8',
        content: `${events.map((event) => JSON.stringify(event)).join('\n')}${events.length ? '\n' : ''}`,
        rowCount: events.length
      };
    }

    const headers = [
      'timestampUtc',
      'tenantId',
      'actorEmail',
      'actionType',
      'outcome',
      'correlationId',
      'resourceType',
      'resourceId',
      'ipAddress',
      'detailsJson'
    ];
    const lines = [headers.join(',')];
    for (const event of events) {
      const values = [
        event.timestampUtc,
        event.tenantId || '',
        event.actorEmail || '',
        event.actionType,
        event.outcome || '',
        event.correlationId || '',
        event.resourceType || '',
        event.resourceId || '',
        event.ipAddress || '',
        event.detailsJson || ''
      ];
      lines.push(values.map((value) => this.escapeCsv(value)).join(','));
    }

    return {
      fileName: `audit_${this.safe(input.tenantId)}_${nowToken}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: `\uFEFF${lines.join('\r\n')}\r\n`,
      rowCount: events.length
    };
  }

  async runDailyArchive(input: {
    tenantId: string;
    actorEmail: string;
    nowUtcIso?: string;
  }): Promise<AuditArchiveRunRecord> {
    const now = new Date(input.nowUtcIso || new Date().toISOString());
    const archiveDateUtc = now.toISOString().slice(0, 10);
    const fromUtcIso = `${archiveDateUtc}T00:00:00.000Z`;
    const toUtcIso = `${archiveDateUtc}T23:59:59.999Z`;
    const events = await this.auditService.listTenantEvents({
      tenantId: input.tenantId,
      fromUtcIso,
      toUtcIso,
      limit: 20_000
    });

    const payload = `${events.map((event) => JSON.stringify(event)).join('\n')}${events.length ? '\n' : ''}`;
    const payloadBytes = Buffer.byteLength(payload, 'utf8');
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const storageTarget = this.storageTarget();
    const localArchivePath = this.localArchivePath(input.tenantId, archiveDateUtc);
    const manifestPath = this.localManifestPath(input.tenantId);

    await mkdir(dirname(localArchivePath), { recursive: true });
    if (payload) {
      await appendFile(localArchivePath, payload, 'utf8');
    } else {
      await appendFile(localArchivePath, '', 'utf8');
    }

    const archiveId = randomUUID();
    const run: AuditArchiveRunRecord = {
      archiveId,
      tenantId: input.tenantId,
      archiveDateUtc,
      triggeredAtUtc: now.toISOString(),
      triggeredBy: input.actorEmail.trim().toLowerCase(),
      storageTarget,
      artifactUri:
        storageTarget === 'azure_blob_grs'
          ? this.azureBlobUri(input.tenantId, archiveDateUtc)
          : localArchivePath,
      manifestUri: manifestPath,
      appendOnly: true,
      recordCount: events.length,
      payloadBytes,
      sha256,
      retentionYears: this.retentionYears()
    };

    await appendFile(manifestPath, `${JSON.stringify(run)}\n`, 'utf8');
    return run;
  }

  async listArchiveRuns(input: {
    tenantId: string;
    limit?: number;
  }): Promise<AuditArchiveRunRecord[]> {
    const limit = this.normalizeLimit(input.limit, 100, 1_000);
    const manifestPath = this.localManifestPath(input.tenantId);
    try {
      const raw = await readFile(manifestPath, 'utf8');
      const rows = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AuditArchiveRunRecord);
      return rows.sort((a, b) => b.triggeredAtUtc.localeCompare(a.triggeredAtUtc)).slice(0, limit);
    } catch {
      return [];
    }
  }

  private localArchivePath(tenantId: string, archiveDateUtc: string): string {
    return resolve(process.cwd(), this.localArchiveDir(), this.safe(tenantId), `${archiveDateUtc}.ndjson`);
  }

  private localManifestPath(tenantId: string): string {
    return resolve(process.cwd(), this.localArchiveDir(), this.safe(tenantId), `manifest.ndjson`);
  }

  private localArchiveDir(): string {
    return process.env.AUDIT_ARCHIVE_LOCAL_DIR || 'artifacts/audit-archive';
  }

  private storageTarget(): 'local' | 'azure_blob_grs' {
    const raw = (process.env.AUDIT_ARCHIVE_STORAGE_TARGET || 'local').trim().toLowerCase();
    return raw === 'azure_blob_grs' ? 'azure_blob_grs' : 'local';
  }

  private azureBlobUri(tenantId: string, archiveDateUtc: string): string {
    const base = (process.env.AUDIT_ARCHIVE_BLOB_BASE_URI || '').trim();
    if (!base) return this.localArchivePath(tenantId, archiveDateUtc);
    return `${base.replace(/\/+$/, '')}/${this.safe(tenantId)}/${archiveDateUtc}.ndjson`;
  }

  private retentionYears(): number {
    const raw = Number(process.env.AUDIT_ARCHIVE_RETENTION_YEARS || 7);
    if (!Number.isFinite(raw) || raw < 7) return 7;
    return Math.trunc(raw);
  }

  private normalizeLimit(value: number | undefined, fallback: number, max: number): number {
    const raw = Number(value ?? fallback);
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.min(max, Math.trunc(raw));
  }

  private timestampToken(value: string): string {
    return value.replace(/[:.]/g, '-');
  }

  private safe(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  private escapeCsv(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

