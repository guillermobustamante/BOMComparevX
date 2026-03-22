import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../database/database.service';
import { DiffComparableRow } from '../diff/diff-contract';
import { BomRegionDetectionService, BomRegionWarning } from './bom-region-detection.service';
import { UploadWorkbookMetadataService } from './upload-workbook-metadata.service';

interface StoredRevision {
  revisionId: string;
  tenantId: string;
  sessionId: string;
  jobId: string;
  slot: 'fileA' | 'fileB';
  fileName: string;
  fileSize: number;
  createdAtUtc: string;
  parserMode: ParserMode;
  sheetName: string;
  headers: string[];
  headerFields: Array<keyof DiffComparableRow | null>;
  headerRowIndex: number;
  dataStartRowIndex: number;
  dataEndRowIndex: number;
  workbookBuffer: Buffer | null;
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

interface ParsedTableResult {
  rows: ParsedTableRow[];
  sheetName: string;
  warnings?: BomRegionWarning[];
  fallbackParserUsed?: boolean;
  diagnostics?: Record<string, unknown>;
}

interface ParseRowsOptions {
  selectedSheetName?: string;
}

export interface ParsedRevisionAnalysis {
  parserMode: ParserMode;
  sheetName: string;
  headers: string[];
  headerFields: Array<keyof DiffComparableRow | null>;
  headerRowIndex: number;
  dataStartRowIndex: number;
  dataEndRowIndex: number;
  workbookBuffer: Buffer | null;
  rows: DiffComparableRow[];
  warnings: BomRegionWarning[];
  fallbackParserUsed: boolean;
  diagnostics?: Record<string, unknown>;
}

const HEADER_ALIASES = {
  partNumber: [
    'part',
    'partnum',
    'partnumber',
    'partno',
    'itemnumber',
    'itemno',
    'pn',
    'partid',
    'itemid',
    'component',
    'componentnumber',
    'mevspartnumber',
    'oempartnumber',
    'cosmapartnumber'
  ],
  revision: ['revision', 'rev', 'version', 'mevscurrentrevision', 'oempartrev', 'cosmarevision', 'revisionlevel'],
  description: [
    'description',
    'desc',
    'details',
    'partname',
    'itemname',
    'partdescription',
    'compdesc',
    'objectdescription',
    'partnameoemcosname'
  ],
  quantity: [
    'quantity',
    'qty',
    'count',
    'neededcount',
    'neededqty',
    'requiredqty',
    'componentquantity',
    'compqtycun',
    'quantityinthisline',
    'quantityinparent',
    'aqqtym',
    'requiredquantity',
    'resultingqty'
  ],
  supplier: ['supplier', 'vendor', 'manufacturer', 'mfr', 'currentsupplier', 'futuresupplier'],
  plant: ['plant', 'werks', 'plantcode'],
  internalId: ['internalid', 'id', 'rowid'],
  occurrenceInternalId: [
    'occurrenceinternalname',
    'occurrenceinternalid',
    'occurrenceid',
    'instanceid',
    'instanceinternalname',
    'itemnode'
  ],
  objectInternalId: ['partkey', 'linkedobjectname', 'linkedobjectid', 'elemid', 'elementid', 'objectid'],
  parentPath: ['parentpath', 'parent', 'path', 'pathpredecessor'],
  position: ['position', 'refdes', 'reference', 'itemnumber', 'lin', 'line', 'findnumber'],
  hierarchyLevel: ['level', 'lvl', 'explosionlevel'],
  assemblyPath: ['assemblypath'],
  findNumber: ['findnumber', 'itemnumber', 'lin', 'line'],
  color: ['color', 'colour'],
  units: ['units', 'unit', 'uom', 'unitofmeasure', 'componentunit', 'baseunitofmeasure'],
  cost: ['unitcost', 'cost', 'extendedcost', 'totalcost'],
  category: ['category', 'group', 'linetype', 'itemcategory', 'commodity']
} as const;

const MAX_PARSED_ROWS = 100_000;

@Injectable()
export class UploadRevisionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadWorkbookMetadataService: UploadWorkbookMetadataService,
    private readonly bomRegionDetectionService: BomRegionDetectionService
  ) {}

  private readonly logger = new Logger(UploadRevisionService.name);
  private readonly revisionsById = new Map<string, StoredRevision>();
  private readonly pairsByJobId = new Map<string, StoredRevisionPair>();
  private readonly latestPairBySession = new Map<string, StoredRevisionPair>();

  async storeRevisionPair(input: {
    tenantId: string;
    sessionId: string;
    jobId: string;
    fileA: Express.Multer.File;
    fileB: Express.Multer.File;
    fileASheetName?: string;
    fileBSheetName?: string;
  }): Promise<StoredRevisionPair> {
    const existing = await this.findPairByJobId(input.tenantId, input.jobId);
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
      fileSize: input.fileA.size,
      createdAtUtc,
      ...this.parseRowsFromFile(input.fileA, 'A', {
        selectedSheetName: input.fileASheetName
      })
    };
    const right: StoredRevision = {
      revisionId: rightRevisionId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      slot: 'fileB',
      fileName: input.fileB.originalname,
      fileSize: input.fileB.size,
      createdAtUtc,
      ...this.parseRowsFromFile(input.fileB, 'B', {
        selectedSheetName: input.fileBSheetName
      })
    };

    this.rememberRevision(left);
    this.rememberRevision(right);

    const pair: StoredRevisionPair = {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      leftRevisionId,
      rightRevisionId
    };
    this.rememberPair(pair);
    await this.persistRevision(left);
    await this.persistRevision(right);
    await this.persistPair(pair);
    return pair;
  }

  async storeChainedRevisionPair(input: {
    tenantId: string;
    sessionId: string;
    jobId: string;
    fileB: Express.Multer.File;
    fileBSheetName?: string;
  }): Promise<StoredRevisionPair> {
    const latestPair = await this.findLatestPairBySession(input.tenantId, input.sessionId);
    if (!latestPair) {
      throw new BadRequestException({
        code: 'UPLOAD_SESSION_NOT_FOUND',
        message: 'Could not find the latest comparison pair for this session.'
      });
    }

    const left = await this.findRevision(input.tenantId, latestPair.rightRevisionId);
    if (!left || left.tenantId !== input.tenantId) {
      throw new BadRequestException({
        code: 'UPLOAD_SESSION_NOT_FOUND',
        message: 'The latest session revision is unavailable for chained comparison.'
      });
    }

    const rightRevisionId = randomUUID();
    const createdAtUtc = new Date().toISOString();
    const right: StoredRevision = {
      revisionId: rightRevisionId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      slot: 'fileB',
      fileName: input.fileB.originalname,
      fileSize: input.fileB.size,
      createdAtUtc,
      ...this.parseRowsFromFile(input.fileB, 'B', {
        selectedSheetName: input.fileBSheetName
      })
    };

    this.rememberRevision(right);

    const pair: StoredRevisionPair = {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      leftRevisionId: left.revisionId,
      rightRevisionId
    };
    this.rememberPair(pair);
    await this.persistRevision(right);
    await this.persistPair(pair);
    return pair;
  }

  async findPairByJobId(tenantId: string, jobId: string): Promise<StoredRevisionPair | null> {
    const pair = this.pairsByJobId.get(jobId);
    if (pair && pair.tenantId === tenantId) return pair;

    if (!this.databaseService.enabled) return null;
    const row = await this.databaseService.client.uploadedRevisionPair.findFirst({
      where: { tenantId, jobId }
    });
    if (!row) return null;
    const mapped = this.mapPairRow(row);
    this.rememberPair(mapped);
    return mapped;
  }

  async findLatestPairBySession(tenantId: string, sessionId: string): Promise<StoredRevisionPair | null> {
    const pair = this.latestPairBySession.get(this.sessionKey(tenantId, sessionId));
    if (pair && pair.tenantId === tenantId) return pair;

    if (!this.databaseService.enabled) return null;
    const row = await this.databaseService.client.uploadedRevisionPair.findFirst({
      where: { tenantId, sessionId },
      orderBy: { createdAtUtc: 'desc' }
    });
    if (!row) return null;
    const mapped = this.mapPairRow(row);
    this.rememberPair(mapped);
    return mapped;
  }

  async getRevisionRows(tenantId: string, revisionId: string): Promise<DiffComparableRow[] | null> {
    const revision = await this.findRevision(tenantId, revisionId);
    if (!revision || revision.tenantId !== tenantId) return null;
    return revision.rows;
  }

  async getRevisionTemplate(
    tenantId: string,
    revisionId: string
  ): Promise<{
    fileName: string;
    parserMode: ParserMode;
    sheetName: string;
    headers: string[];
    headerFields: Array<keyof DiffComparableRow | null>;
    headerRowIndex: number;
    dataStartRowIndex: number;
    dataEndRowIndex: number;
    workbookBuffer: Buffer | null;
  } | null> {
    const revision = await this.findRevision(tenantId, revisionId);
    if (!revision || revision.tenantId !== tenantId) return null;
    return {
      fileName: revision.fileName,
      parserMode: revision.parserMode,
      sheetName: revision.sheetName,
      headers: [...revision.headers],
      headerFields: [...revision.headerFields],
      headerRowIndex: revision.headerRowIndex,
      dataStartRowIndex: revision.dataStartRowIndex,
      dataEndRowIndex: revision.dataEndRowIndex,
      workbookBuffer: revision.workbookBuffer ? Buffer.from(revision.workbookBuffer) : null
    };
  }

  async getRevisionFileMeta(
    tenantId: string,
    revisionId: string
  ): Promise<{
    revisionId: string;
    fileName: string;
    fileSize: number;
    createdAtUtc: string;
  } | null> {
    const revision = await this.findRevision(tenantId, revisionId);
    if (!revision || revision.tenantId !== tenantId) return null;
    return {
      revisionId: revision.revisionId,
      fileName: revision.fileName,
      fileSize: revision.fileSize,
      createdAtUtc: revision.createdAtUtc
    };
  }

  private async findRevision(tenantId: string, revisionId: string): Promise<StoredRevision | null> {
    const cached = this.revisionsById.get(revisionId);
    if (cached && cached.tenantId === tenantId) return cached;

    if (!this.databaseService.enabled) return null;
    const row = await this.databaseService.client.uploadedRevision.findFirst({
      where: { tenantId, revisionId }
    });
    if (!row) return null;
    const mapped = this.mapRevisionRow(row);
    this.rememberRevision(mapped);
    return mapped;
  }

  private async persistRevision(revision: StoredRevision): Promise<void> {
    if (!this.databaseService.enabled) return;
    await this.databaseService.client.uploadedRevision.upsert({
      where: { revisionId: revision.revisionId },
      update: {
        rowsJson: JSON.stringify(revision.rows),
        workbookBuffer: revision.workbookBuffer ? Buffer.from(revision.workbookBuffer) : null,
        headersJson: JSON.stringify(revision.headers),
        headerFieldsJson: JSON.stringify(revision.headerFields)
      },
      create: {
        revisionId: revision.revisionId,
        tenantId: revision.tenantId,
        sessionId: revision.sessionId,
        jobId: revision.jobId,
        slot: revision.slot,
        fileName: revision.fileName,
        fileSize: revision.fileSize,
        createdAtUtc: new Date(revision.createdAtUtc),
        parserMode: revision.parserMode,
        sheetName: revision.sheetName,
        headersJson: JSON.stringify(revision.headers),
        headerFieldsJson: JSON.stringify(revision.headerFields),
        headerRowIndex: revision.headerRowIndex,
        dataStartRowIndex: revision.dataStartRowIndex,
        dataEndRowIndex: revision.dataEndRowIndex,
        workbookBuffer: revision.workbookBuffer ? Buffer.from(revision.workbookBuffer) : null,
        rowsJson: JSON.stringify(revision.rows)
      }
    });
  }

  private async persistPair(pair: StoredRevisionPair): Promise<void> {
    if (!this.databaseService.enabled) return;
    await this.databaseService.client.uploadedRevisionPair.upsert({
      where: { jobId: pair.jobId },
      update: {
        sessionId: pair.sessionId,
        leftRevisionId: pair.leftRevisionId,
        rightRevisionId: pair.rightRevisionId
      },
      create: {
        pairId: randomUUID(),
        tenantId: pair.tenantId,
        sessionId: pair.sessionId,
        jobId: pair.jobId,
        leftRevisionId: pair.leftRevisionId,
        rightRevisionId: pair.rightRevisionId,
        createdAtUtc: new Date()
      }
    });
  }

  private rememberRevision(revision: StoredRevision): void {
    this.revisionsById.set(revision.revisionId, revision);
  }

  private rememberPair(pair: StoredRevisionPair): void {
    this.pairsByJobId.set(pair.jobId, pair);
    this.latestPairBySession.set(this.sessionKey(pair.tenantId, pair.sessionId), pair);
  }

  private mapPairRow(row: {
    tenantId: string;
    sessionId: string;
    jobId: string;
    leftRevisionId: string;
    rightRevisionId: string;
  }): StoredRevisionPair {
    return {
      tenantId: row.tenantId,
      sessionId: row.sessionId,
      jobId: row.jobId,
      leftRevisionId: row.leftRevisionId,
      rightRevisionId: row.rightRevisionId
    };
  }

  private mapRevisionRow(row: {
    revisionId: string;
    tenantId: string;
    sessionId: string;
    jobId: string;
    slot: string;
    fileName: string;
    fileSize: number;
    createdAtUtc: Date;
    parserMode: string;
    sheetName: string;
    headersJson: string;
    headerFieldsJson: string;
    headerRowIndex: number;
    dataStartRowIndex: number;
    dataEndRowIndex: number;
    workbookBuffer: Uint8Array | null;
    rowsJson: string;
  }): StoredRevision {
    return {
      revisionId: row.revisionId,
      tenantId: row.tenantId,
      sessionId: row.sessionId,
      jobId: row.jobId,
      slot: row.slot === 'fileA' ? 'fileA' : 'fileB',
      fileName: row.fileName,
      fileSize: row.fileSize,
      createdAtUtc: row.createdAtUtc.toISOString(),
      parserMode: row.parserMode === 'csv' ? 'csv' : 'xlsx',
      sheetName: row.sheetName,
      headers: this.parseJson<string[]>(row.headersJson, []),
      headerFields: this.parseJson<Array<keyof DiffComparableRow | null>>(row.headerFieldsJson, []),
      headerRowIndex: row.headerRowIndex,
      dataStartRowIndex: row.dataStartRowIndex,
      dataEndRowIndex: row.dataEndRowIndex,
      workbookBuffer: row.workbookBuffer ? Buffer.from(row.workbookBuffer) : null,
      rows: this.parseJson<DiffComparableRow[]>(row.rowsJson, [])
    };
  }

  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private sessionKey(tenantId: string, sessionId: string): string {
    return `${tenantId}::${sessionId}`;
  }

  analyzeFile(file: Express.Multer.File, prefix: string, options?: ParseRowsOptions): ParsedRevisionAnalysis {
    return this.parseRowsFromFileDetailed(file, prefix, options);
  }

  private parseRowsFromFile(
    file: Express.Multer.File,
    prefix: string,
    options?: ParseRowsOptions
  ): {
    parserMode: ParserMode;
    sheetName: string;
    headers: string[];
    headerFields: Array<keyof DiffComparableRow | null>;
    headerRowIndex: number;
    dataStartRowIndex: number;
    dataEndRowIndex: number;
    workbookBuffer: Buffer | null;
    rows: DiffComparableRow[];
  } {
    const parsed = this.parseRowsFromFileDetailed(file, prefix, options);
    return {
      parserMode: parsed.parserMode,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      headerFields: parsed.headerFields,
      headerRowIndex: parsed.headerRowIndex,
      dataStartRowIndex: parsed.dataStartRowIndex,
      dataEndRowIndex: parsed.dataEndRowIndex,
      workbookBuffer: parsed.workbookBuffer,
      rows: parsed.rows
    };
  }

  private parseRowsFromFileDetailed(
    file: Express.Multer.File,
    prefix: string,
    options?: ParseRowsOptions
  ): ParsedRevisionAnalysis {
    const correlationId = randomUUID();
    const extension = extname(file.originalname || '').toLowerCase();

    let parserMode: ParserMode;
    let parsed: ParsedTableResult;
    try {
      if (extension === '.csv') {
        parserMode = 'csv';
        parsed = this.parseCsvTable(file, correlationId);
      } else if (extension === '.xlsx' || extension === '.xls') {
        parserMode = 'xlsx';
        parsed = this.parseWorkbookTable(file, correlationId, options?.selectedSheetName);
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

    const materialized = this.materializeParsedTable(file, prefix, parserMode, parsed, correlationId);
    if (parsed.warnings?.length || parsed.diagnostics) {
      this.logger.log(
        JSON.stringify({
          metricName: 'upload.parse.selection',
          fileName: file.originalname,
          selectedSheetName: options?.selectedSheetName || null,
          actualSheetName: materialized.sheetName,
          fallbackParserUsed: parsed.fallbackParserUsed || false,
          warnings: parsed.warnings || [],
          diagnostics: parsed.diagnostics || {},
          emittedAtUtc: new Date().toISOString()
        })
      );
    }
    return {
      ...materialized,
      warnings: parsed.warnings || [],
      fallbackParserUsed: parsed.fallbackParserUsed || false,
      diagnostics: parsed.diagnostics
    };
  }

  private materializeParsedTable(
    file: Express.Multer.File,
    prefix: string,
    parserMode: ParserMode,
    parsed: ParsedTableResult,
    correlationId: string
  ): Omit<ParsedRevisionAnalysis, 'warnings' | 'fallbackParserUsed' | 'diagnostics'> {
    const headerRow = parsed.rows.find((row) => row.values.some((value) => value.trim().length > 0));
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
    const plantIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.plant);
    const internalIdIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.internalId);
    const occurrenceInternalIdIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.occurrenceInternalId);
    const objectInternalIdIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.objectInternalId);
    const parentPathIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.parentPath);
    const positionIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.position);
    const hierarchyLevelIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.hierarchyLevel);
    const assemblyPathIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.assemblyPath);
    const findNumberIndex = this.findHeaderIndex(headerColumns, HEADER_ALIASES.findNumber);
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

    const indexToField = new Map<number, keyof DiffComparableRow>();
    const maybeSetField = (index: number, field: keyof DiffComparableRow): void => {
      if (index >= 0) {
        indexToField.set(index, field);
      }
    };
    maybeSetField(occurrenceInternalIdIndex, 'occurrenceInternalId');
    maybeSetField(objectInternalIdIndex, 'objectInternalId');
    maybeSetField(internalIdIndex, 'internalId');
    maybeSetField(partIndex, 'partNumber');
    maybeSetField(revisionIndex, 'revision');
    maybeSetField(descriptionIndex, 'description');
    maybeSetField(quantityIndex, 'quantity');
    maybeSetField(supplierIndex, 'supplier');
    maybeSetField(plantIndex, 'plant');
    maybeSetField(colorIndex, 'color');
    maybeSetField(unitsIndex, 'units');
    maybeSetField(costIndex, 'cost');
    maybeSetField(categoryIndex, 'category');
    maybeSetField(parentPathIndex, 'parentPath');
    maybeSetField(positionIndex, 'position');
    maybeSetField(assemblyPathIndex, 'assemblyPath');
    maybeSetField(findNumberIndex, 'findNumber');
    maybeSetField(hierarchyLevelIndex, 'hierarchyLevel');
    const headerFields = headerRow.values.map((_header, index) => indexToField.get(index) || null);

    const rows: DiffComparableRow[] = [];
    for (const tableRow of parsed.rows) {
      if (tableRow.sourceRowIndex <= headerRow.sourceRowIndex) continue;
      const values = tableRow.values;
      if (!values.some((value) => value.trim().length > 0)) continue;
      const properties = headerRow.values.reduce<Record<string, string | null>>((acc, header, index) => {
        const key = header.trim();
        if (!key) return acc;
        acc[key] = this.pick(values, index) ?? null;
        return acc;
      }, {});
      rows.push({
        rowId: `${prefix}-${tableRow.sourceRowIndex}`,
        internalId: this.resolvePreferredInternalId(values, {
          internalIdIndex,
          occurrenceInternalIdIndex,
          objectInternalIdIndex
        }),
        occurrenceInternalId: this.pick(values, occurrenceInternalIdIndex),
        objectInternalId: this.pick(values, objectInternalIdIndex),
        partNumber: this.pick(values, partIndex),
        revision: this.pick(values, revisionIndex),
        description: this.pick(values, descriptionIndex),
        quantity: this.pickNumber(values, quantityIndex),
        supplier: this.pick(values, supplierIndex),
        plant: this.pick(values, plantIndex),
        color: this.pick(values, colorIndex),
        units: this.pick(values, unitsIndex),
        cost: this.pickNumber(values, costIndex),
        category: this.pick(values, categoryIndex),
        parentPath: this.pick(values, parentPathIndex),
        position: this.pick(values, positionIndex),
        assemblyPath: this.pick(values, assemblyPathIndex),
        findNumber: this.pick(values, findNumberIndex),
        hierarchyLevel: this.parseHierarchyLevel(this.pick(values, hierarchyLevelIndex)),
        properties
      });
    }

    const enrichedRows = this.applyHierarchyInference(rows);

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
      `Parsed revision file "${file.originalname}" mode=${parserMode} rows=${enrichedRows.length} correlationId=${correlationId}`
    );
    return {
      parserMode,
      sheetName: parsed.sheetName,
      headers: [...headerRow.values],
      headerFields,
      headerRowIndex: headerRow.sourceRowIndex,
      dataStartRowIndex: headerRow.sourceRowIndex + 1,
      dataEndRowIndex:
        parsed.rows.reduce((max, row) => Math.max(max, row.sourceRowIndex), headerRow.sourceRowIndex),
      workbookBuffer: parserMode === 'xlsx' ? Buffer.from(file.buffer) : null,
      rows: enrichedRows
    };
  }

  private parseCsvTable(file: Express.Multer.File, correlationId: string): ParsedTableResult {
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

    const parsedRows = content.split(/\r?\n/).map((line, index) => ({
      sourceRowIndex: index + 1,
      values: this.parseCsvLine(line)
    }));
    if (!this.smartDetectionEnabled()) {
      return {
        sheetName: 'Comparison Results',
        rows: parsedRows
      };
    }

    const detection = this.bomRegionDetectionService.detect(parsedRows);
    return {
      sheetName: 'Comparison Results',
      rows: detection.rows,
      warnings: detection.warnings,
      fallbackParserUsed: detection.fallbackUsed,
      diagnostics: detection.diagnostics
    };
  }

  private parseWorkbookTable(
    file: Express.Multer.File,
    correlationId: string,
    selectedSheetName?: string
  ): ParsedTableResult {
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

    const metadata = this.uploadWorkbookMetadataService.inspectFile(file);
    const chosenSheet =
      selectedSheetName &&
      selectedSheetName !== 'CSV' &&
      metadata.visibleSheets.some((sheet) => sheet.name === selectedSheetName)
        ? selectedSheetName
        : metadata.selectedSheetName;
    if (!chosenSheet) {
      this.throwParseError({
        code: 'UPLOAD_PARSE_WORKBOOK_EMPTY',
        message: `File "${file.originalname}" does not contain sheets.`,
        correlationId,
        parserMode: 'xlsx',
        fileName: file.originalname,
        reason: 'no_sheets'
      });
    }

    const worksheet = workbook.Sheets[chosenSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: true,
      raw: false,
      defval: ''
    }) as unknown[][];

    const parsedRows = rows.map((row, index) => ({
      sourceRowIndex: index + 1,
      values: Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    }));

    const smartDetectionEnabled = this.smartDetectionEnabled();
    if (!smartDetectionEnabled) {
      return {
        sheetName: chosenSheet,
        rows: parsedRows
      };
    }

    const detection = this.bomRegionDetectionService.detect(parsedRows);

    return {
      sheetName: chosenSheet,
      rows: detection.rows,
      warnings: detection.warnings,
      fallbackParserUsed: detection.fallbackUsed,
      diagnostics: detection.diagnostics
    };
  }

  private smartDetectionEnabled(): boolean {
    const raw = process.env.UPLOAD_BOM_REGION_DETECTION_V1;
    if (!raw) return false;
    return !['false', '0', 'off', 'no'].includes(raw.trim().toLowerCase());
  }

  private findHeaderIndex(headers: string[], aliases: readonly string[]): number {
    const exactMatch = headers.findIndex((header) => aliases.includes(header));
    if (exactMatch >= 0) return exactMatch;
    return headers.findIndex((header) => {
      if (!header) return false;
      return aliases.some((alias) => {
        if (!alias) return false;
        if (alias === header) return true;
        if (alias.length <= 3 || header.length <= 3) return false;
        return header.includes(alias) || alias.includes(header);
      });
    });
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

  private resolvePreferredInternalId(
    values: string[],
    indexes: {
      internalIdIndex: number;
      occurrenceInternalIdIndex: number;
      objectInternalIdIndex: number;
    }
  ): string | null {
    return (
      this.pick(values, indexes.occurrenceInternalIdIndex) ||
      this.pick(values, indexes.internalIdIndex) ||
      this.pick(values, indexes.objectInternalIdIndex)
    );
  }

  private parseHierarchyLevel(value: string | null): number | null {
    if (!value) return null;
    const direct = Number(value);
    if (Number.isFinite(direct)) {
      return Math.max(0, Math.floor(direct));
    }

    // SAP-style "explosion level" uses dot-prefix tokens like "..2".
    const dotted = value.match(/(\d+)$/);
    if (dotted) {
      const level = Number(dotted[1]);
      if (Number.isFinite(level)) return Math.max(0, Math.floor(level));
    }

    const markerCount = (value.match(/\./g) || []).length;
    return markerCount > 0 ? markerCount : null;
  }

  private applyHierarchyInference(rows: DiffComparableRow[]): DiffComparableRow[] {
    const levelStack: string[] = [];

    return rows.map((row) => {
      let parentPath = this.normalizeHierarchyToken(row.parentPath);
      let level = row.hierarchyLevel ?? null;

      if (!parentPath && row.assemblyPath) {
        const parts = row.assemblyPath.split('/').map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          parentPath = parts.slice(0, -1).join('/');
        }
      }

      if (level === null && parentPath) {
        const slashCount = (parentPath.match(/\//g) || []).length;
        if (slashCount > 0) {
          level = slashCount;
        }
      }

      if (!parentPath && level !== null && level > 0) {
        const parentKey = levelStack[level - 1] || null;
        if (parentKey) {
          parentPath = parentKey;
        }
      }

      const identity =
        row.partNumber ||
        row.occurrenceInternalId ||
        row.internalId ||
        row.objectInternalId ||
        row.description ||
        row.assemblyPath ||
        row.rowId;
      if (level !== null) {
        levelStack[level] = identity;
        levelStack.length = level + 1;
      } else if (!parentPath) {
        levelStack.length = 1;
        levelStack[0] = identity;
      }

      return {
        ...row,
        parentPath: parentPath || null,
        hierarchyLevel: level
      };
    });
  }

  private normalizeHierarchyToken(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return `IDX:${trimmed}`;
    }
    return trimmed.replace(/\s+/g, ' ');
  }
}
