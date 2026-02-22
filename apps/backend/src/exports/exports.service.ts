import { Injectable } from '@nestjs/common';
import { DiffJobService } from '../diff/diff-job.service';

interface BuildCsvInput {
  comparisonId: string;
  tenantId: string;
  requestedBy: string;
}

interface CsvExportPayload {
  fileName: string;
  content: string;
}

@Injectable()
export class ExportsService {
  constructor(private readonly diffJobService: DiffJobService) {}

  buildComparisonCsv(input: BuildCsvInput): CsvExportPayload {
    const exportRows = this.diffJobService.getRowsForExport(
      input.comparisonId,
      input.tenantId,
      input.requestedBy
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
    return {
      fileName,
      content: `\uFEFF${lines.join('\r\n')}\r\n`
    };
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
}
