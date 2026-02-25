import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../database/database.service';
import { DiffJobService } from '../diff/diff-job.service';
import { DiffComparableRow } from '../diff/diff-contract';
import { UploadRevisionService } from '../uploads/upload-revision.service';
import { ExportArtifactRecord } from './export-artifact.interface';

interface BuildCsvInput {
  comparisonId: string;
  tenantId: string;
  requestedBy: string;
}

interface CsvExportPayload {
  fileName: string;
  content: string;
}

interface ExcelExportPayload {
  fileName: string;
  content: Buffer;
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly diffJobService: DiffJobService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly databaseService: DatabaseService
  ) {}

  private readonly artifactsById = new Map<string, ExportArtifactRecord>();

  async buildComparisonCsv(input: BuildCsvInput): Promise<CsvExportPayload> {
    const exportRows = this.diffJobService.getRowsForExport(
      input.comparisonId,
      input.tenantId
    );

    const headers = [
      'comparisonId',
      'rowId',
      'changeType',
      'sourceIndex',
      'targetIndex',
      'partNumber',
      'revision',
      'description',
      'classificationReason',
      'matchReason',
      'reviewRequired',
      'score',
      'changedFields',
      'cellsJson'
    ];

    const lines = [headers.join(',')];
    for (const row of exportRows.rows) {
      const values = [
        exportRows.jobId,
        row.rowId,
        row.changeType,
        String(row.sourceIndex),
        String(row.targetIndex),
        row.keyFields.partNumber || '',
        row.keyFields.revision || '',
        row.keyFields.description || '',
        row.rationale.classificationReason || '',
        row.rationale.matchReason || '',
        String(Boolean(row.rationale.reviewRequired)),
        row.rationale.score === undefined ? '' : String(row.rationale.score),
        row.rationale.changedFields.join(';'),
        JSON.stringify(row.cells)
      ];
      lines.push(values.map((value) => this.escapeCsv(value)).join(','));
    }

    const fileName = `bomcompare_${this.sanitizeFileToken(exportRows.jobId)}_results.csv`;
    const payload = {
      fileName,
      content: `\uFEFF${lines.join('\r\n')}\r\n`
    };

    await this.recordArtifact({
      tenantId: input.tenantId,
      comparisonId: input.comparisonId,
      requestedBy: input.requestedBy,
      format: 'csv',
      fileName,
      byteSize: Buffer.byteLength(payload.content, 'utf8')
    });

    return payload;
  }

  async buildComparisonExcel(input: BuildCsvInput): Promise<ExcelExportPayload> {
    const exportRows = this.diffJobService.getRowsForExport(
      input.comparisonId,
      input.tenantId
    );

    const template =
      exportRows.rightRevisionId
        ? this.uploadRevisionService.getRevisionTemplate(input.tenantId, exportRows.rightRevisionId)
        : null;

    const headers =
      template?.headers?.length
        ? [...template.headers]
        : ['Part Number', 'Revision', 'Description', 'Quantity', 'Supplier', 'Color', 'Units', 'Cost', 'Category'];
    const headerFields =
      template?.headerFields?.length
        ? [...template.headerFields]
        : ([
            'partNumber',
            'revision',
            'description',
            'quantity',
            'supplier',
            'color',
            'units',
            'cost',
            'category'
          ] as Array<keyof DiffComparableRow | null>);

    const metadataHeaders = ['Change Type', 'Changed Fields', 'Classification Reason'];
    const sheetData: Array<Array<string | number>> = [headers.concat(metadataHeaders)];

    for (const row of exportRows.rows) {
      const coreValues = headers.map((_header, index) =>
        this.resolveFieldValue(row, headerFields[index] || null)
      );
      sheetData.push(
        coreValues.concat([
          row.changeType,
          row.rationale.changedFields.join(';'),
          row.rationale.classificationReason || ''
        ])
      );
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: headers.length + metadataHeaders.length - 1, r: Math.max(1, sheetData.length) - 1 }
      })
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, this.safeSheetName(template?.sheetName || 'Comparison Results'));

    const fileName = `bomcompare_${this.sanitizeFileToken(exportRows.jobId)}_results.xlsx`;
    const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;

    await this.recordArtifact({
      tenantId: input.tenantId,
      comparisonId: input.comparisonId,
      requestedBy: input.requestedBy,
      format: 'excel',
      fileName,
      byteSize: content.length
    });

    return { fileName, content };
  }

  async pruneArtifactsOlderThan(cutoffUtcIso: string): Promise<number> {
    const cutoff = new Date(cutoffUtcIso);
    let removed = 0;

    for (const [artifactId, artifact] of this.artifactsById.entries()) {
      if (new Date(artifact.createdAtUtc) < cutoff) {
        this.artifactsById.delete(artifactId);
        removed += 1;
      }
    }

    if (this.databaseService.enabled) {
      const result = await this.databaseService.client.exportArtifact.deleteMany({
        where: {
          createdAtUtc: {
            lt: cutoff
          }
        }
      });
      return result.count;
    }

    return removed;
  }

  private escapeCsv(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private sanitizeFileToken(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  private resolveFieldValue(
    row: ReturnType<DiffJobService['getRowsForExport']>['rows'][number],
    field: keyof DiffComparableRow | null
  ): string | number {
    if (!field) return '';
    const preferred = row.targetSnapshot || row.sourceSnapshot || null;
    if (!preferred) return '';
    const value = preferred[field];
    if (value === null || value === undefined) return '';
    return typeof value === 'number' ? value : String(value);
  }

  private safeSheetName(name: string): string {
    const trimmed = (name || 'Comparison Results')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim();
    if (!trimmed) return 'Comparison Results';
    return trimmed.slice(0, 31);
  }

  private async recordArtifact(input: {
    tenantId: string;
    comparisonId: string;
    requestedBy: string;
    format: ExportArtifactRecord['format'];
    fileName: string;
    byteSize: number;
  }): Promise<void> {
    const createdAtUtc = new Date().toISOString();
    const artifact: ExportArtifactRecord = {
      artifactId: randomUUID(),
      tenantId: input.tenantId,
      comparisonId: input.comparisonId,
      requestedBy: input.requestedBy.trim().toLowerCase(),
      format: input.format,
      fileName: input.fileName,
      byteSize: input.byteSize,
      createdAtUtc
    };
    this.artifactsById.set(artifact.artifactId, artifact);

    if (!this.databaseService.enabled) return;
    await this.databaseService.client.exportArtifact.create({
      data: {
        artifactId: artifact.artifactId,
        tenantId: artifact.tenantId,
        comparisonId: artifact.comparisonId,
        requestedBy: artifact.requestedBy,
        format: artifact.format,
        fileName: artifact.fileName,
        byteSize: artifact.byteSize,
        createdAtUtc: new Date(artifact.createdAtUtc)
      }
    });
  }
}
