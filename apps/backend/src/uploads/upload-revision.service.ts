import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';
import { DiffComparableRow } from '../diff/diff-contract';

interface StoredRevision {
  revisionId: string;
  tenantId: string;
  sessionId: string;
  jobId: string;
  slot: 'fileA' | 'fileB';
  fileName: string;
  createdAtUtc: string;
  rows: DiffComparableRow[];
}

interface StoredRevisionPair {
  tenantId: string;
  sessionId: string;
  jobId: string;
  leftRevisionId: string;
  rightRevisionId: string;
}

type ParserMode = 'csv' | 'xlsx';

interface ParsedTableRow {
  sourceRowIndex: number;
  values: string[];
}

const HEADER_ALIASES = {
  partNumber: ['partnumber', 'partno', 'pn', 'itemnumber', 'part', 'partid', 'itemid'],
  revision: ['revision', 'rev', 'version'],
  description: ['description', 'desc', 'details', 'name', 'partname', 'partdescription'],
  quantity: ['quantity', 'qty', 'count', 'neededcount', 'neededqty', 'requiredqty'],
  supplier: ['supplier', 'vendor', 'manufacturer', 'mfr'],
  internalId: ['internalid', 'id', 'rowid', 'elemid', 'elementid'],
  parentPath: ['parentpath', 'parent', 'path'],
  position: ['position', 'refdes', 'reference'],
  color: ['color', 'colour'],
  units: ['units', 'unit', 'uom', 'unitofmeasure'],
  cost: ['unitcost', 'cost', 'extendedcost', 'totalcost'],
  category: ['category', 'group']
} as const;

const MAX_PARSED_ROWS = 100_000;

@Injectable()
export class UploadRevisionService {
  private readonly logger = new Logger(UploadRevisionService.name);
  private readonly revisionsById = new Map<string, StoredRevision>();
  private readonly pairsByJobId = new Map<string, StoredRevisionPair>();
  private readonly latestPairBySession = new Map<string, StoredRevisionPair>();

  storeRevisionPair(input: {
    tenantId: string;
    sessionId: string;
    jobId: string;
    fileA: Express.Multer.File;
    fileB: Express.Multer.File;
  }): StoredRevisionPair {
    const existing = this.pairsByJobId.get(input.jobId);
    if (existing) return existing;

    const leftRevisionId = randomUUID();
    const rightRevisionId = randomUUID();
    const createdAtUtc = new Date().toISOString();

    const left: StoredRevision = {
      revisionId: leftRevisionId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      slot: 'fileA',
      fileName: input.fileA.originalname,
      createdAtUtc,
      rows: this.parseRowsFromFile(input.fileA, 'A')
    };
    const right: StoredRevision = {
      revisionId: rightRevisionId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      slot: 'fileB',
      fileName: input.fileB.originalname,
      createdAtUtc,
      rows: this.parseRowsFromFile(input.fileB, 'B')
    };

    this.revisionsById.set(leftRevisionId, left);
    this.revisionsById.set(rightRevisionId, right);

    const pair: StoredRevisionPair = {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      leftRevisionId,
      rightRevisionId
    };
    this.pairsByJobId.set(input.jobId, pair);
    this.latestPairBySession.set(this.sessionKey(input.tenantId, input.sessionId), pair);
    return pair;
  }

  findPairByJobId(tenantId: string, jobId: string): StoredRevisionPair | null {
    const pair = this.pairsByJobId.get(jobId);
    if (!pair) return null;
    if (pair.tenantId !== tenantId) return null;
    return pair;
  }

  findLatestPairBySession(tenantId: string, sessionId: string): StoredRevisionPair | null {
    const pair = this.latestPairBySession.get(this.sessionKey(tenantId, sessionId));
    if (!pair) return null;
    if (pair.tenantId !== tenantId) return null;
    return pair;
  }

  getRevisionRows(tenantId: string, revisionId: string): DiffComparableRow[] | null {
    const revision = this.revisionsById.get(revisionId);
    if (!revision || revision.tenantId !== tenantId) return null;
    return revision.rows;
  }

  private sessionKey(tenantId: string, sessionId: string): string {
    return `${tenantId}::${sessionId}`;
  }

  private parseRowsFromFile(file: Express.Multer.File, prefix: string): DiffComparableRow[] {
    const correlationId = randomUUID();
    const extension = extname(file.originalname || '').toLowerCase();

    let parserMode: ParserMode;
    let parsedTable: ParsedTableRow[];
    try {
      if (extension === '.csv') {
        parserMode = 'csv';
        parsedTable = this.parseCsvTable(file, correlationId);
      } else if (extension === '.xlsx' || extension === '.xls') {
        parserMode = 'xlsx';
        parsedTable = this.parseWorkbookTable(file, correlationId);
      } else {
        this.throwParseError({
          code: 'UPLOAD_PARSE_FORMAT_UNSUPPORTED',
          message: `File "${file.originalname}" format is not supported for revision parsing.`,
          correlationId,
          parserMode: 'csv',
          fileName: file.originalname,
          reason: `unsupported_extension:${extension || 'none'}`
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.throwParseError({
        code: 'UPLOAD_PARSE_FAILED',
        message: `Failed to parse file "${file.originalname}".`,
        correlationId,
        parserMode: extension === '.csv' ? 'csv' : 'xlsx',
        fileName: file.originalname,
        reason: error instanceof Error ? error.message : 'unexpected_parse_error'
      });
    }

    const headerRow = parsedTable.find((row) => row.values.some((value) => value.trim().length > 0));
    if (!headerRow) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_EMPTY_FILE',
        message: `File "${file.originalname}" does not contain a readable header row.`,
        correlationId,
        parserMode,
        fileName: file.originalname,
        reason: 'empty_header_row'
      });
    }

    const headerColumns = headerRow.values.map((header) => this.normalizeHeader(header));
    const partIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.partNumber);
    const revisionIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.revision);
    const descriptionIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.description);
    const quantityIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.quantity);
    const supplierIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.supplier);
    const internalIdIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.internalId);
    const parentPathIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.parentPath);
    const positionIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.position);
    const colorIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.color);
    const unitsIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.units);
    const totalCostIndex = this.findHeaderIndex(headerColumns, ['cost', 'extendedcost', 'totalcost']);
    const unitCostIndex = this.findHeaderIndex(headerColumns, ['unitcost']);
    const costIndex = totalCostIndex >= 0 ? totalCostIndex : unitCostIndex;
    const categoryIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.category);

    const requiredSignalCount = [partIndex, descriptionIndex, quantityIndex].filter((idx) => idx >= 0).length;
    if (requiredSignalCount < 2) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_HEADERS_UNRECOGNIZED',
        message: `File "${file.originalname}" is missing recognizable BOM headers (need at least two of Part Number, Description, Quantity).`,
        correlationId,
        parserMode,
        fileName: file.originalname,
        reason: 'required_headers_not_recognized'
      });
    }

    const rows: DiffComparableRow[] = [];
    for (const tableRow of parsedTable) {
      if (tableRow.sourceRowIndex <= headerRow.sourceRowIndex) continue;
      const values = tableRow.values;
      if (!values.some((value) => value.trim().length > 0)) continue;
      rows.push({
        rowId: `${prefix}-${tableRow.sourceRowIndex}`,
        internalId: this.pick(values, internalIdIndex),
        partNumber: this.pick(values, partIndex),
        revision: this.pick(values, revisionIndex),
        description: this.pick(values, descriptionIndex),
        quantity: this.pickNumber(values, quantityIndex),
        supplier: this.pick(values, supplierIndex),
        color: this.pick(values, colorIndex),
        units: this.pick(values, unitsIndex),
        cost: this.pickNumber(values, costIndex),
        category: this.pick(values, categoryIndex),
        parentPath: this.pick(values, parentPathIndex),
        position: this.pick(values, positionIndex)
      });
    }

    if (rows.length > MAX_PARSED_ROWS) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_ROW_LIMIT_EXCEEDED',
        message: `File "${file.originalname}" exceeds the maximum supported row count (${MAX_PARSED_ROWS}).`,
        correlationId,
        parserMode,
        fileName: file.originalname,
        reason: `row_count:${rows.length}`
      });
    }

    if (this.looksLikeRowExplosion(rows.length, file.size)) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_SUSPICIOUS_ROW_EXPLOSION',
        message: `File "${file.originalname}" produced suspicious parse output and was rejected.`,
        correlationId,
        parserMode,
        fileName: file.originalname,
        reason: `row_count:${rows.length};file_size:${file.size}`
      });
    }

    this.logger.log(
      `Parsed revision file "${file.originalname}" mode=${parserMode} rows=${rows.length} correlationId=${correlationId}`
    );
    return rows;
  }

  private parseCsvTable(file: Express.Multer.File, correlationId: string): ParsedTableRow[] {
    const content = file.buffer?.toString('utf8') || '';
    if (content.includes('\u0000')) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_CSV_BINARY_CONTENT',
        message: `File "${file.originalname}" contains binary content and cannot be parsed as CSV.`,
        correlationId,
        parserMode: 'csv',
        fileName: file.originalname,
        reason: 'null_byte_detected'
      });
    }

    return content.split(/\r?\n/).map((line, index) => ({
      sourceRowIndex: index + 1,
      values: this.parseCsvLine(line)
    }));
  }

  private parseWorkbookTable(file: Express.Multer.File, correlationId: string): ParsedTableRow[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        raw: false,
        cellText: true
      });
    } catch (error) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_WORKBOOK_INVALID',
        message: `File "${file.originalname}" is not a valid workbook.`,
        correlationId,
        parserMode: 'xlsx',
        fileName: file.originalname,
        reason: error instanceof Error ? error.message : 'workbook_read_failed'
      });
    }

    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_WORKBOOK_EMPTY',
        message: `File "${file.originalname}" does not contain sheets.`,
        correlationId,
        parserMode: 'xlsx',
        fileName: file.originalname,
        reason: 'no_sheets'
      });
    }

    const worksheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: ''
    }) as unknown[][];

    return rows.map((row, index) => ({
      sourceRowIndex: index + 1,
      values: Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    }));
  }

  private findHeaderIndex(headers: string[], aliases: readonly string[]): number {
    return headers.findIndex((header) => aliases.includes(header));
  }

  private looksLikeRowExplosion(rowCount: number, fileSize: number): boolean {
    if (rowCount < 1000 || fileSize <= 0) return false;
    const bytesPerRow = fileSize / rowCount;
    return bytesPerRow < 6;
  }

  private throwParseError(input: {
    code: string;
    message: string;
    correlationId: string;
    parserMode: ParserMode;
    fileName: string;
    reason: string;
  }): never {
    this.logger.warn(
      `[${input.code}] mode=${input.parserMode} file="${input.fileName}" correlationId=${input.correlationId} reason=${input.reason}`
    );
    throw new BadRequestException({
      code: input.code,
      message: input.message,
      correlationId: input.correlationId,
      parserMode: input.parserMode
    });
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        const nextChar = line[i + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current.trim());
    return values;
  }

  private normalizeHeader(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  private pick(values: string[], index: number): string | null {
    if (index < 0 || index >= values.length) return null;
    const value = values[index]?.trim();
    return value ? value : null;
  }

  private pickNumber(values: string[], index: number): number | null {
    const value = this.pick(values, index);
    if (!value) return null;
    const numeric = value.replace(/[$,\s]/g, '');
    const parsed = Number(numeric);
    if (Number.isNaN(parsed)) return null;
    return parsed;
  }
}
