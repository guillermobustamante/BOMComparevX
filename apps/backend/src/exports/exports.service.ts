import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../database/database.service';
import { DiffJobService } from '../diff/diff-job.service';
import { DiffComparableRow, PersistedDiffRow } from '../diff/diff-contract';
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

const INLINE_METADATA_HEADERS = ['Change Type', 'Changed Fields', 'Classification Reason'];

@Injectable()
export class ExportsService {
  constructor(
    private readonly diffJobService: DiffJobService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly databaseService: DatabaseService
  ) {}

  private readonly artifactsById = new Map<string, ExportArtifactRecord>();

  async buildComparisonCsv(input: BuildCsvInput): Promise<CsvExportPayload> {
    const exportRows = await this.diffJobService.getRowsForExport(
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
    const exportRows = await this.diffJobService.getRowsForExport(
      input.comparisonId,
      input.tenantId
    );

    const template =
      exportRows.rightRevisionId
        ? await this.uploadRevisionService.getRevisionTemplate(input.tenantId, exportRows.rightRevisionId)
        : null;

    if (template?.parserMode === 'xlsx' && template.workbookBuffer) {
      return this.buildTemplatePreservingExcel(input, exportRows, template);
    }

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

    const sheetData: Array<Array<string | number>> = [headers.concat(INLINE_METADATA_HEADERS)];

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
        e: { c: headers.length + INLINE_METADATA_HEADERS.length - 1, r: Math.max(1, sheetData.length) - 1 }
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

  private async buildTemplatePreservingExcel(
    input: BuildCsvInput,
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>,
    template: NonNullable<Awaited<ReturnType<UploadRevisionService['getRevisionTemplate']>>>
  ): Promise<ExcelExportPayload> {
    const workbook = XLSX.read(template.workbookBuffer, {
      type: 'buffer',
      raw: false,
      cellText: true,
      cellNF: true,
      cellStyles: true,
      bookFiles: true
    });
    const targetSheetName = template.sheetName || workbook.SheetNames[0] || 'Comparison Results';
    if (!workbook.Sheets[targetSheetName]) {
      return this.buildComparisonExcelFallback(input, exportRows, template);
    }

    const fileName = `bomcompare_${this.sanitizeFileToken(exportRows.jobId)}_results.xlsx`;
    const metadataSheetName = this.uniqueSheetName(workbook, 'Change Impact Classification');
    const content = this.patchWorkbookTemplatePackage(
      template.workbookBuffer!,
      targetSheetName,
      metadataSheetName,
      exportRows,
      template
    );

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

  private async buildComparisonExcelFallback(
    input: BuildCsvInput,
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>,
    template: {
      headers: string[];
      headerFields: Array<keyof DiffComparableRow | null>;
      sheetName: string;
    }
  ): Promise<ExcelExportPayload> {
    const headers =
      template.headers?.length
        ? [...template.headers]
        : ['Part Number', 'Revision', 'Description', 'Quantity', 'Supplier', 'Color', 'Units', 'Cost', 'Category'];
    const headerFields =
      template.headerFields?.length
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
    const sheetData: Array<Array<string | number>> = [headers.concat(INLINE_METADATA_HEADERS)];
    for (const row of exportRows.rows) {
      const coreValues = headers.map((_header, index) => this.resolveFieldValue(row, headerFields[index] || null));
      sheetData.push(coreValues.concat([row.changeType, row.rationale.changedFields.join(';'), row.rationale.classificationReason || '']));
    }
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: headers.length + INLINE_METADATA_HEADERS.length - 1, r: Math.max(1, sheetData.length) - 1 }
      })
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, this.safeSheetName(template.sheetName || 'Comparison Results'));
    this.appendMetadataSheet(workbook, exportRows);
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

  private writeTemplateHeaderRow(
    worksheet: XLSX.WorkSheet,
    template: {
      headerRowIndex: number;
      headers: string[];
    },
    metadataStartCol: number
  ): void {
    const headerRowZeroBased = template.headerRowIndex - 1;
    const styleSourceCell = worksheet[XLSX.utils.encode_cell({ c: Math.max(template.headers.length - 1, 0), r: headerRowZeroBased })];
    INLINE_METADATA_HEADERS.forEach((header, offset) => {
      const address = XLSX.utils.encode_cell({ c: metadataStartCol + offset, r: headerRowZeroBased });
      const nextCell = worksheet[address] || { t: 's' };
      nextCell.t = 's';
      nextCell.v = header;
      nextCell.w = header;
      if (styleSourceCell?.s) {
        nextCell.s = this.cloneStyle(styleSourceCell.s);
      }
      worksheet[address] = nextCell;
    });
  }

  private writeTemplateMetadataRow(
    worksheet: XLSX.WorkSheet,
    rowIndex: number,
    styleSourceRow: number,
    exportRow: PersistedDiffRow | undefined,
    metadataStartCol: number,
    templateColumnCount: number
  ): void {
    const targetRow = rowIndex - 1;
    const styleRow = styleSourceRow - 1;

    INLINE_METADATA_HEADERS.forEach((header, offset) => {
      const address = XLSX.utils.encode_cell({ c: metadataStartCol + offset, r: targetRow });
      const styleSourceAddress = XLSX.utils.encode_cell({ c: Math.max(templateColumnCount - 1, 0), r: styleRow });
      const nextValue =
        !exportRow
          ? ''
          : header === 'Change Type'
            ? exportRow.changeType
            : header === 'Changed Fields'
              ? exportRow.rationale.changedFields.join(';')
              : exportRow.rationale.classificationReason || '';
      worksheet[address] = this.buildCell(nextValue, worksheet[styleSourceAddress]);
    });
  }

  private buildCell(value: string | number, styleSource?: XLSX.CellObject): XLSX.CellObject {
    const nextCell: XLSX.CellObject = typeof value === 'number'
      ? { t: 'n', v: value }
      : { t: 's', v: value, w: String(value) };
    if (styleSource?.z) {
      nextCell.z = styleSource.z;
    }
    if (styleSource?.s) {
      nextCell.s = this.cloneStyle(styleSource.s);
    }
    return nextCell;
  }

  private ensureMetadataColumns(
    worksheet: XLSX.WorkSheet,
    metadataStartCol: number,
    count: number
  ): void {
    const existing = worksheet['!cols'] ? [...worksheet['!cols']] : [];
    const styleSource = existing[Math.max(metadataStartCol - 1, 0)] || { width: 18, wch: 18 };
    for (let index = 0; index < count; index += 1) {
      if (!existing[metadataStartCol + index]) {
        existing[metadataStartCol + index] = { ...styleSource };
      }
    }
    worksheet['!cols'] = existing;
  }

  private resizeWorkbookTables(
    workbook: XLSX.WorkBook & { files?: Record<string, { content: string | Buffer }> },
    worksheet: XLSX.WorkSheet,
    targetSheetName: string,
    tableColumnCount: number,
    headerRowIndex: number,
    dataEndRowIndex: number
  ): void {
    const files = workbook.files;
    if (!files) return;
    const sheetIndex = workbook.SheetNames.findIndex((name) => name === targetSheetName);
    if (sheetIndex < 0) return;
    const relPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`;
    const relFile = files[relPath];
    if (!relFile) return;
    const relXml = String(relFile.content);
    const targets = [...relXml.matchAll(/Target=\"\.\.\/tables\/([^"]+)\"/g)].map((match) => match[1]);
    if (targets.length === 0) return;

    const ref = `A${headerRowIndex}:${XLSX.utils.encode_col(tableColumnCount - 1)}${Math.max(headerRowIndex, dataEndRowIndex)}`;
    worksheet['!autofilter'] = worksheet['!autofilter'] || { ref };

    for (const target of targets) {
      const tablePath = `xl/tables/${target}`;
      const tableFile = files[tablePath];
      if (!tableFile) continue;
      const tableXml = String(tableFile.content)
        .replace(/ref=\"[A-Z0-9:]+\"/g, (match, offset, full) => {
          const prefix = full.slice(Math.max(0, offset - 12), offset);
          return prefix.includes('autoFilter') || prefix.includes('table ')
            ? `ref="${ref}"`
            : match;
        });
      tableFile.content = tableXml;
    }
  }

  private appendMetadataSheet(
    workbook: XLSX.WorkBook,
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>
  ): void {
    const metadataSheetName = this.uniqueSheetName(workbook, 'Change Impact Classification');
    const metadataRows = this.buildImpactClassificationRows(exportRows);
    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: metadataRows[0].length - 1, r: Math.max(1, metadataRows.length) - 1 }
      })
    };
    metadataSheet['!cols'] = [{ hidden: true }];
    XLSX.utils.book_append_sheet(workbook, metadataSheet, metadataSheetName);
  }

  private uniqueSheetName(workbook: XLSX.WorkBook, preferred: string): string {
    const base = this.safeSheetName(preferred);
    if (!workbook.SheetNames.includes(base)) return base;
    let suffix = 2;
    while (suffix < 100) {
      const candidate = this.safeSheetName(`${base} ${suffix}`);
      if (!workbook.SheetNames.includes(candidate)) return candidate;
      suffix += 1;
    }
    return this.safeSheetName(`${base} copy`);
  }

  private cloneStyle<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private patchWorkbookTemplatePackage(
    templateBuffer: Buffer,
    targetSheetName: string,
    metadataSheetName: string,
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>,
    template: NonNullable<Awaited<ReturnType<UploadRevisionService['getRevisionTemplate']>>>
  ): Buffer {
    const zip = unzipSync(new Uint8Array(templateBuffer));
    let workbookXml = strFromU8(zip['xl/workbook.xml']);
    let workbookRelsXml = strFromU8(zip['xl/_rels/workbook.xml.rels']);
    let contentTypesXml = strFromU8(zip['[Content_Types].xml']);
    let appXml = strFromU8(zip['docProps/app.xml']);

    const targetSheet = this.resolveWorksheetPart(workbookXml, workbookRelsXml, targetSheetName);
    if (!targetSheet) {
      return templateBuffer;
    }

    const oldLastCol = XLSX.utils.encode_col(Math.max(template.headers.length - 1, 0));
    const newLastCol = XLSX.utils.encode_col(template.headers.length + INLINE_METADATA_HEADERS.length - 1);
    const tableHeaders = template.headers.concat(INLINE_METADATA_HEADERS);
    const rowMetadataMap = this.buildInlineMetadataByTemplateRow(exportRows, template);

    const sheetXml = strFromU8(zip[targetSheet.sheetPath]);
    zip[targetSheet.sheetPath] = strToU8(
      this.patchWorksheetXml(sheetXml, template, rowMetadataMap, oldLastCol, newLastCol)
    );

    if (zip[targetSheet.sheetRelsPath]) {
      const sheetRelsXml = strFromU8(zip[targetSheet.sheetRelsPath]);
      const tableTargets = [...sheetRelsXml.matchAll(/Target=\"\.\.\/tables\/([^"]+)\"/g)].map((match: RegExpMatchArray) => match[1]);
      for (const target of tableTargets) {
        const tablePath = `xl/tables/${target}`;
        if (zip[tablePath]) {
          zip[tablePath] = strToU8(
            this.patchTableXml(
              strFromU8(zip[tablePath]),
              template,
              tableHeaders,
              newLastCol
            )
          );
        }
        const tableRelsPath = `xl/tables/_rels/${target}.rels`;
        if (zip[tableRelsPath]) {
          const tableRelsXml = strFromU8(zip[tableRelsPath]);
          const queryTargets = [...tableRelsXml.matchAll(/Target=\"\.\.\/queryTables\/([^"]+)\"/g)].map((match: RegExpMatchArray) => match[1]);
          for (const queryTarget of queryTargets) {
            const queryPath = `xl/queryTables/${queryTarget}`;
            if (zip[queryPath]) {
              zip[queryPath] = strToU8(
                this.patchQueryTableXml(strFromU8(zip[queryPath]), tableHeaders)
              );
            }
          }
        }
      }
      workbookXml = this.patchWorkbookDefinedNamesRange(
        workbookXml,
        targetSheetName,
        template.headerRowIndex,
        template.dataEndRowIndex,
        oldLastCol,
        newLastCol
      );
    }

    const nextSheetIndex = this.nextWorksheetIndex(zip);
    const nextSheetId = this.nextSheetId(workbookXml);
    const nextRelId = this.nextRelationshipId(workbookRelsXml);
    const metadataSheetPath = `xl/worksheets/sheet${nextSheetIndex}.xml`;
    zip[metadataSheetPath] = strToU8(this.buildMetadataSheetXml(exportRows));

    workbookRelsXml = workbookRelsXml.replace(
      '</Relationships>',
      `<Relationship Id="rId${nextRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${nextSheetIndex}.xml"/></Relationships>`
    );
    workbookXml = workbookXml.replace(
      '</sheets>',
      `<sheet name="${this.escapeXmlAttribute(metadataSheetName)}" sheetId="${nextSheetId}" r:id="rId${nextRelId}"/></sheets>`
    );
    contentTypesXml = this.ensureContentTypeOverride(
      contentTypesXml,
      `/xl/worksheets/sheet${nextSheetIndex}.xml`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
    );
    appXml = this.patchAppXmlForNewSheet(appXml, metadataSheetName);

    zip['xl/workbook.xml'] = strToU8(workbookXml);
    zip['xl/_rels/workbook.xml.rels'] = strToU8(workbookRelsXml);
    zip['[Content_Types].xml'] = strToU8(contentTypesXml);
    zip['docProps/app.xml'] = strToU8(appXml);

    return Buffer.from(zipSync(zip));
  }

  private resolveWorksheetPart(
    workbookXml: string,
    workbookRelsXml: string,
    targetSheetName: string
  ): { sheetPath: string; sheetRelsPath: string } | null {
    const sheetMatches = [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^\/]*\/>/g)];
    const targetSheet = sheetMatches.find((match) => match[1] === targetSheetName);
    if (!targetSheet) return null;
    const relId = targetSheet[2];
    const relTags = [...workbookRelsXml.matchAll(/<Relationship\b[^>]*\/>/g)].map((match) => match[0]);
    const relTag = relTags.find(
      (tag) =>
        tag.includes(`Id="${relId}"`) &&
        tag.includes('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"')
    );
    if (!relTag) return null;
    const targetMatch = relTag.match(/\bTarget="([^"]+)"/);
    if (!targetMatch) return null;
    const relativePath = targetMatch[1].replace(/^\//, '');
    const sheetPath = relativePath.startsWith('xl/') ? relativePath : `xl/${relativePath}`;
    const sheetFileName = sheetPath.split('/').pop() || '';
    return {
      sheetPath,
      sheetRelsPath: `xl/worksheets/_rels/${sheetFileName}.rels`
    };
  }

  private buildInlineMetadataByTemplateRow(
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>,
    template: NonNullable<Awaited<ReturnType<UploadRevisionService['getRevisionTemplate']>>>
  ): Map<number, PersistedDiffRow> {
    const rowMap = new Map<number, PersistedDiffRow>();
    for (const row of exportRows.rows) {
      const templateRowIndex = this.tryExtractTemplateRowIndex(row.targetSnapshot?.rowId || null);
      if (!templateRowIndex) continue;
      if (templateRowIndex < template.dataStartRowIndex || templateRowIndex > template.dataEndRowIndex) continue;
      rowMap.set(templateRowIndex, row);
    }
    return rowMap;
  }

  private patchWorksheetXml(
    sheetXml: string,
    template: NonNullable<Awaited<ReturnType<UploadRevisionService['getRevisionTemplate']>>>,
    rowMetadataMap: Map<number, PersistedDiffRow>,
    oldLastCol: string,
    newLastCol: string
  ): string {
    const newMaxColNumber = template.headers.length + INLINE_METADATA_HEADERS.length;
    let nextXml = sheetXml;

    nextXml = nextXml.replace(/<dimension\b([^>]*)ref="([^:]+):([A-Z]+)(\d+)"([^>]*)\/>/, (_match, before, startRef, _endCol, endRow, after) => {
      return `<dimension${before}ref="${startRef}:${newLastCol}${endRow}"${after}/>`;
    });
    nextXml = nextXml.replace(/<autoFilter\b([^>]*)ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"([^>]*)\/>/g, (_match, before, startCol, startRow, _endCol, endRow, after) => {
      return `<autoFilter${before}ref="${startCol}${startRow}:${newLastCol}${endRow}"${after}/>`;
    });
    nextXml = this.patchWorksheetCols(nextXml, template.headers.length, INLINE_METADATA_HEADERS.length);

    nextXml = nextXml.replace(/<row\b[\s\S]*?<\/row>/g, (rowXml) => {
      const rowIndexMatch = rowXml.match(/\br="(\d+)"/);
      if (!rowIndexMatch) return rowXml;
      const rowIndex = Number(rowIndexMatch[1]);
      const needsMetadata = rowIndex === template.headerRowIndex || (rowIndex >= template.dataStartRowIndex && rowIndex <= template.dataEndRowIndex);
      if (!needsMetadata) return rowXml;

      const styleId = this.extractRowStyleId(rowXml, `${oldLastCol}${rowIndex}`);
      const values =
        rowIndex === template.headerRowIndex
          ? INLINE_METADATA_HEADERS
          : this.inlineMetadataValues(rowMetadataMap.get(rowIndex));
      let nextRowXml = rowXml.replace(/\bspans="(\d+):(\d+)"/, `spans="1:${newMaxColNumber}"`);
      INLINE_METADATA_HEADERS.forEach((_, offset) => {
        const cellRef = `${XLSX.utils.encode_col(template.headers.length + offset)}${rowIndex}`;
        nextRowXml = nextRowXml.replace(new RegExp(`<c\\b[^>]*r="${cellRef}"[\\s\\S]*?<\\/c>|<c\\b[^>]*r="${cellRef}"[^>]*/>`, 'g'), '');
        nextRowXml = nextRowXml.replace(
          '</row>',
          `${this.buildInlineStringCellXml(cellRef, values[offset], styleId)}</row>`
        );
      });
      return nextRowXml;
    });

    return nextXml;
  }

  private patchWorksheetCols(sheetXml: string, originalColumnCount: number, extraColumnCount: number): string {
    const colStart = originalColumnCount + 1;
    const colEnd = originalColumnCount + extraColumnCount;
    const colsMatch = sheetXml.match(/<cols>([\s\S]*?)<\/cols>/);
    if (!colsMatch) {
      return sheetXml.replace(
        '<sheetData>',
        `<cols><col min="${colStart}" max="${colEnd}" width="18" customWidth="1"/></cols><sheetData>`
      );
    }

    const inner = colsMatch[1];
    const colTags = [...inner.matchAll(/<col\b[^>]*\/>/g)].map((match) => match[0]);
    const lastColTag = colTags[colTags.length - 1] || '<col min="1" max="1" width="18" customWidth="1"/>';
    const appended = Array.from({ length: extraColumnCount }, (_unused, index) => {
      const colNumber = originalColumnCount + index + 1;
      const attrs = lastColTag
        .replace(/^<col\s*/, '')
        .replace(/\/>$/, '')
        .replace(/(?:^|\s)min="[^"]*"/g, '')
        .replace(/(?:^|\s)max="[^"]*"/g, '');
      return `<col min="${colNumber}" max="${colNumber}"${attrs.startsWith(' ') ? attrs : ` ${attrs}`}/>`;
    }).join('');
    return sheetXml.replace(/<cols>[\s\S]*?<\/cols>/, `<cols>${inner}${appended}</cols>`);
  }

  private extractRowStyleId(rowXml: string, preferredCellRef: string): string | null {
    const preferred = rowXml.match(new RegExp(`<c\\b[^>]*r="${preferredCellRef}"[^>]*\\bs="(\\d+)"[^>]*>`));
    if (preferred) return preferred[1];
    const styledCells = [...rowXml.matchAll(/<c\b[^>]*\bs="(\d+)"[^>]*>/g)];
    return styledCells.length ? styledCells[styledCells.length - 1][1] : null;
  }

  private inlineMetadataValues(row: PersistedDiffRow | undefined): string[] {
    if (!row) {
      return ['', '', ''];
    }
    return [
      row.changeType,
      row.rationale.changedFields.join(';'),
      row.rationale.classificationReason || ''
    ];
  }

  private buildInlineStringCellXml(cellRef: string, value: string, styleId: string | null): string {
    const styleAttr = styleId ? ` s="${styleId}"` : '';
    if (!value) {
      return `<c r="${cellRef}"${styleAttr}/>`;
    }
    const escaped = this.escapeXmlText(value);
    const preserve = value.trim() !== value || value.includes('\n') ? ' xml:space="preserve"' : '';
    return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t${preserve}>${escaped}</t></is></c>`;
  }

  private patchTableXml(
    tableXml: string,
    template: NonNullable<Awaited<ReturnType<UploadRevisionService['getRevisionTemplate']>>>,
    tableHeaders: string[],
    newLastCol: string
  ): string {
    const endRow = Math.max(template.headerRowIndex, template.dataEndRowIndex);
    const ref = `A${template.headerRowIndex}:${newLastCol}${endRow}`;
    const existingColumns = [...tableXml.matchAll(/<tableColumn\b[^>]*\/>/g)].map((match) => match[0]);
    const nextColumns = tableHeaders.map((header, index) => {
      if (existingColumns[index]) {
        return existingColumns[index]
          .replace(/\bname="[^"]*"/, `name="${this.escapeXmlAttribute(header)}"`)
          .replace(/\bid="\d+"/, `id="${index + 1}"`)
          .replace(/\buniqueName="[^"]*"/, `uniqueName="${index + 1}"`)
          .replace(/\bqueryTableFieldId="\d+"/, `queryTableFieldId="${index + 1}"`);
      }
      return `<tableColumn id="${index + 1}" uniqueName="${index + 1}" name="${this.escapeXmlAttribute(header)}" queryTableFieldId="${index + 1}"/>`;
    }).join('');
    return tableXml
      .replace(/ref="[^"]*"/, `ref="${ref}"`)
      .replace(/<autoFilter\b([^>]*)ref="[^"]*"/, `<autoFilter$1 ref="${ref}"`)
      .replace(/<tableColumns\b[^>]*count="\d+"[^>]*>[\s\S]*?<\/tableColumns>/, `<tableColumns count="${tableHeaders.length}">${nextColumns}</tableColumns>`);
  }

  private patchQueryTableXml(xml: string, tableHeaders: string[]): string {
    const existingFields = [...xml.matchAll(/<queryTableField\b[^>]*\/>/g)].map((match) => match[0]);
    const nextFields = tableHeaders.map((header, index) => {
      if (existingFields[index]) {
        return existingFields[index]
          .replace(/\bname="[^"]*"/, `name="${this.escapeXmlAttribute(header)}"`)
          .replace(/\bid="\d+"/, `id="${index + 1}"`)
          .replace(/\btableColumnId="\d+"/, `tableColumnId="${index + 1}"`);
      }
      return `<queryTableField id="${index + 1}" name="${this.escapeXmlAttribute(header)}" tableColumnId="${index + 1}"/>`;
    }).join('');
    return xml
      .replace(/<queryTableRefresh\b([^>]*)nextId="\d+"/, `<queryTableRefresh$1 nextId="${tableHeaders.length + 1}"`)
      .replace(/<queryTableFields\b[^>]*count="\d+"[^>]*>[\s\S]*?<\/queryTableFields>/, `<queryTableFields count="${tableHeaders.length}">${nextFields}</queryTableFields>`);
  }

  private patchWorkbookDefinedNamesRange(
    workbookXml: string,
    sheetName: string,
    headerRowIndex: number,
    dataEndRowIndex: number,
    oldLastCol: string,
    newLastCol: string
  ): string {
    const oldUnquoted = `${sheetName}!$A$${headerRowIndex}:$${oldLastCol}$${dataEndRowIndex}`;
    const newUnquoted = `${sheetName}!$A$${headerRowIndex}:$${newLastCol}$${dataEndRowIndex}`;
    const escapedSheetName = sheetName.replace(/'/g, "''");
    const oldQuoted = `'${escapedSheetName}'!$A$${headerRowIndex}:$${oldLastCol}$${dataEndRowIndex}`;
    const newQuoted = `'${escapedSheetName}'!$A$${headerRowIndex}:$${newLastCol}$${dataEndRowIndex}`;
    return workbookXml.split(oldQuoted).join(newQuoted).split(oldUnquoted).join(newUnquoted);
  }

  private nextWorksheetIndex(zip: Record<string, Uint8Array>): number {
    const matches = Object.keys(zip)
      .map((path) => path.match(/^xl\/worksheets\/sheet(\d+)\.xml$/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match) => Number(match[1]));
    return matches.length ? Math.max(...matches) + 1 : 1;
  }

  private nextSheetId(workbookXml: string): number {
    const ids = [...workbookXml.matchAll(/\bsheetId="(\d+)"/g)].map((match: RegExpMatchArray) => Number(match[1]));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  private nextRelationshipId(workbookRelsXml: string): number {
    const ids = [...workbookRelsXml.matchAll(/\bId="rId(\d+)"/g)].map((match: RegExpMatchArray) => Number(match[1]));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  private buildMetadataSheetXml(
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>
  ): string {
    const rows = this.buildImpactClassificationRows(exportRows);
    const headers = rows[0];
    const endCol = XLSX.utils.encode_col(headers.length - 1);
    const rowXml = rows.map((values, rowOffset) => {
      const rowNumber = rowOffset + 1;
      const cells = values.map((value, colOffset) => {
        const ref = `${XLSX.utils.encode_col(colOffset)}${rowNumber}`;
        return this.buildInlineStringCellXml(ref, String(value), null);
      }).join('');
      return `<row r="${rowNumber}" spans="1:${headers.length}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="A1:${endCol}${rows.length}"/>` +
      `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols><col min="1" max="1" hidden="1" width="0" customWidth="1"/></cols>` +
      `<sheetData>${rowXml}</sheetData>` +
      `<autoFilter ref="A1:${endCol}${rows.length}"/>` +
      `</worksheet>`;
  }

  private buildImpactClassificationRows(
    exportRows: Awaited<ReturnType<DiffJobService['getRowsForExport']>>
  ): Array<Array<string | number>> {
    const headers = [
      'comparisonId',
      'rowId',
      'changeType',
      'partNumber',
      'revision',
      'description',
      'changedFields',
      'classificationReason',
      'impactCriticality',
      'impactClass',
      'categories',
      'changeDescriptions',
      'internalApprovingRoles',
      'externalApprovingRoles',
      'complianceTriggers'
    ];

    return [
      headers,
      ...exportRows.rows.map((row) => [
        exportRows.jobId,
        row.rowId,
        row.changeType,
        row.keyFields.partNumber || '',
        row.keyFields.revision || '',
        row.keyFields.description || '',
        row.rationale.changedFields.join(';'),
        row.rationale.classificationReason || '',
        row.impactClassification?.impactCriticality || '',
        row.impactClassification?.highestImpactClass || '',
        row.impactClassification?.categories.map((category) => category.category).join('; ') || '',
        row.impactClassification?.categories.map((category) => category.changeDescription).join(' | ') || '',
        row.impactClassification?.internalApprovingRoles.join('; ') || '',
        row.impactClassification?.externalApprovingRoles.join('; ') || '',
        row.impactClassification?.complianceTriggers.join('; ') || ''
      ])
    ];
  }

  private patchAppXmlForNewSheet(appXml: string, sheetName: string): string {
    const worksheetCountMatch = appXml.match(/<vt:i4>(\d+)<\/vt:i4>/);
    const titlesSizeMatch = appXml.match(/<vt:vector size="(\d+)" baseType="lpstr">/);
    const nextWorksheetCount = worksheetCountMatch ? Number(worksheetCountMatch[1]) + 1 : 1;
    const nextTitleCount = titlesSizeMatch ? Number(titlesSizeMatch[1]) + 1 : 1;
    return appXml
      .replace(/<vt:i4>\d+<\/vt:i4>/, `<vt:i4>${nextWorksheetCount}</vt:i4>`)
      .replace(/<vt:vector size="\d+" baseType="lpstr">/, `<vt:vector size="${nextTitleCount}" baseType="lpstr">`)
      .replace('</vt:vector></TitlesOfParts>', `<vt:lpstr>${this.escapeXmlText(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts>`);
  }

  private escapeXmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private reinjectTemplateTables(
    templateBuffer: Buffer,
    exportedBuffer: Buffer,
    targetSheetName: string,
    sheetIndexOneBased: number,
    headerRowIndex: number,
    dataEndRowIndex: number,
    tableColumnCount: number,
    columnHeaders: string[]
  ): Buffer {
    const templateWorkbook = XLSX.read(templateBuffer, { type: 'buffer', bookFiles: true });
    const templateSheetIndex = templateWorkbook.SheetNames.findIndex((name) => name === targetSheetName) + 1;
    if (templateSheetIndex <= 0 || sheetIndexOneBased <= 0) return exportedBuffer;

    const templateZip = unzipSync(new Uint8Array(templateBuffer));
    const exportedZip = unzipSync(new Uint8Array(exportedBuffer));
    const templateRelsPath = `xl/worksheets/_rels/sheet${templateSheetIndex}.xml.rels`;
    const exportedRelsPath = `xl/worksheets/_rels/sheet${sheetIndexOneBased}.xml.rels`;
    const templateRelsContent = templateZip[templateRelsPath];
    if (!templateRelsContent) return exportedBuffer;

    const templateRelsXml = strFromU8(templateRelsContent);
    const tableTargets = [...templateRelsXml.matchAll(/Target=\"\.\.\/tables\/([^"]+)\"/g)].map((match: RegExpMatchArray) => match[1]);
    if (tableTargets.length === 0) return exportedBuffer;

    const tableRef = `A${headerRowIndex}:${XLSX.utils.encode_col(tableColumnCount - 1)}${Math.max(headerRowIndex, dataEndRowIndex)}`;
    let exportedRelsXml = exportedZip[exportedRelsPath]
      ? strFromU8(exportedZip[exportedRelsPath])
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    let contentTypesXml = exportedZip['[Content_Types].xml']
      ? strFromU8(exportedZip['[Content_Types].xml'])
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';
    for (const target of tableTargets) {
      const tablePath = `xl/tables/${target}`;
      const templateTableContent = templateZip[tablePath];
      if (!templateTableContent) continue;
      const tableXml = this.normalizeTableXml(strFromU8(templateTableContent), tableRef, columnHeaders);
      exportedZip[tablePath] = strToU8(tableXml);
      exportedRelsXml = this.ensureTableRelationship(exportedRelsXml, target);
      contentTypesXml = this.ensureContentTypeOverride(
        contentTypesXml,
        `/xl/tables/${target}`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml'
      );
    }

    exportedZip[exportedRelsPath] = strToU8(exportedRelsXml);
    exportedZip['[Content_Types].xml'] = strToU8(contentTypesXml);
    return Buffer.from(zipSync(exportedZip));
  }

  private normalizeTableXml(xml: string, ref: string, columnHeaders: string[]): string {
    const columnDefinitions = columnHeaders
      .map((header, index) => `<tableColumn id="${index + 1}" name="${this.escapeXmlAttribute(header)}"/>`)
      .join('');
    const tableColumnsXml = `<tableColumns count="${columnHeaders.length}">${columnDefinitions}</tableColumns>`;
    return xml
      .replace(/\s+tableType=\"queryTable\"/g, '')
      .replace(/\s+queryTableFieldId=\"[^\"]*\"/g, '')
      .replace(/\s+xr3:uid=\"[^\"]*\"/g, '')
      .replace(/\s+xr:uid=\"[^\"]*\"/g, '')
      .replace(/<table\b([^>]*)\sref=\"[^\"]*\"/g, '<table$1 ref="' + ref + '"')
      .replace(/<autoFilter\b([^>]*)\sref=\"[^\"]*\"/g, '<autoFilter$1 ref="' + ref + '"')
      .replace(/<tableColumns\b[^>]*>[\s\S]*?<\/tableColumns>/, tableColumnsXml);
  }

  private ensureTableRelationship(xml: string, target: string): string {
    if (xml.includes(`Target="../tables/${target}"`)) {
      return xml;
    }
    const ids = [...xml.matchAll(/Id=\"rId(\d+)\"/g)].map((match: RegExpMatchArray) => Number(match[1]));
    const nextId = ids.length === 0 ? 1 : Math.max(...ids) + 1;
    const relation = `<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/${target}"/>`;
    return xml.replace('</Relationships>', `${relation}</Relationships>`);
  }

  private ensureContentTypeOverride(xml: string, partName: string, contentType: string): string {
    if (xml.includes(`PartName="${partName}"`)) {
      return xml;
    }
    return xml.replace('</Types>', `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
  }

  private tryExtractTemplateRowIndex(rowId: string | null): number | null {
    if (!rowId) return null;
    const match = rowId.match(/-(\d+)$/);
    if (!match) return null;
    const rowIndex = Number(match[1]);
    return Number.isFinite(rowIndex) && rowIndex > 0 ? rowIndex : null;
  }

  private escapeXmlAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private resolveFieldValue(
    row: PersistedDiffRow,
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
