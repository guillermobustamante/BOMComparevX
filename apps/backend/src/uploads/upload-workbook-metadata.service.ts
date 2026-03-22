import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface WorkbookSheetOption {
  name: string;
  preferred: boolean;
  reason?: string;
}

export interface WorkbookMetadataResult {
  fileKind: 'csv' | 'workbook';
  visibleSheets: WorkbookSheetOption[];
  selectedSheetName: string;
  dropdownDisabled: boolean;
  warnings: string[];
}

@Injectable()
export class UploadWorkbookMetadataService {
  inspectFile(file: Express.Multer.File): WorkbookMetadataResult {
    const extension = this.extensionOf(file.originalname);
    if (extension === '.csv') {
      return {
        fileKind: 'csv',
        visibleSheets: [{ name: 'CSV', preferred: true, reason: 'single_text_source' }],
        selectedSheetName: 'CSV',
        dropdownDisabled: true,
        warnings: []
      };
    }

    if (extension !== '.xlsx' && extension !== '.xls') {
      throw new BadRequestException({
        code: 'UPLOAD_FILE_TYPE_INVALID',
        message: `File "${file.originalname}" must be CSV, XLS, or XLSX.`
      });
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        raw: false,
        cellText: true
      });
    } catch {
      throw new BadRequestException({
        code: 'UPLOAD_PARSE_WORKBOOK_INVALID',
        message: `File "${file.originalname}" is not a valid workbook.`,
        parserMode: 'xlsx'
      });
    }

    const visibleSheets = this.visibleSheetNames(workbook);
    if (!visibleSheets.length) {
      throw new BadRequestException({
        code: 'UPLOAD_PARSE_WORKBOOK_EMPTY',
        message: `File "${file.originalname}" does not contain visible sheets.`,
        parserMode: 'xlsx'
      });
    }

    const ranked = visibleSheets
      .map((name) => {
        const nameScore = this.sheetScore(name);
        const contentScore = this.sheetContentScore(workbook, name);
        return {
        name,
          score: nameScore + contentScore,
          nameScore,
          contentScore,
          reason: this.sheetReason(name, contentScore)
        };
      })
      .sort((a, b) => b.score - a.score || b.contentScore - a.contentScore || a.name.localeCompare(b.name));

    const selectedSheetName = ranked[0]?.name || visibleSheets[0];
    return {
      fileKind: 'workbook',
      visibleSheets: ranked.map((sheet) => ({
        name: sheet.name,
        preferred: sheet.name === selectedSheetName,
        reason: sheet.reason
      })),
      selectedSheetName,
      dropdownDisabled: false,
      warnings: []
    };
  }

  private visibleSheetNames(workbook: XLSX.WorkBook): string[] {
    const workbookSheets = workbook.Workbook?.Sheets || [];
    const visibilityByName = new Map<string, number>();
    for (const sheet of workbookSheets) {
      if (!sheet?.name) continue;
      visibilityByName.set(sheet.name, typeof sheet.Hidden === 'number' ? sheet.Hidden : 0);
    }

    return workbook.SheetNames.filter((name) => (visibilityByName.get(name) || 0) === 0);
  }

  private sheetScore(name: string): number {
    const normalized = this.normalizeName(name);
    if (normalized === 'bom') return 100;
    if (normalized === 'billofmaterials') return 95;
    if (normalized === 'parts') return 90;
    if (normalized === 'components') return 85;
    if (normalized.includes('bom')) return 80;
    if (normalized.includes('billofmaterials')) return 75;
    if (normalized.includes('parts')) return 70;
    if (normalized.includes('components')) return 65;
    return 10;
  }

  private sheetReason(name: string, contentScore: number): string {
    const normalized = this.normalizeName(name);
    if (normalized === 'bom' || normalized.includes('bom')) return 'name_matches_bom';
    if (normalized === 'billofmaterials' || normalized.includes('billofmaterials')) {
      return 'name_matches_bill_of_materials';
    }
    if (normalized === 'parts' || normalized.includes('parts')) return 'name_matches_parts';
    if (normalized === 'components' || normalized.includes('components')) return 'name_matches_components';
    if (contentScore >= 30) return 'content_matches_bom';
    return 'visible_sheet_fallback';
  }

  private sheetContentScore(workbook: XLSX.WorkBook, sheetName: string): number {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return 0;

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: true,
      raw: false,
      defval: ''
    }) as unknown[][];

    let bestRowScore = 0;
    const sampleRows = rows.slice(0, 25);
    for (const row of sampleRows) {
      if (!Array.isArray(row)) continue;
      const normalized = row.map((cell) => this.normalizeName(String(cell ?? ''))).filter(Boolean);
      if (!normalized.length) continue;
      const signalCount = [
        normalized.some((value) => ['part', 'partnumber', 'partno', 'itemnumber', 'itemno', 'component'].includes(value)),
        normalized.some((value) => ['description', 'desc', 'partname', 'itemname', 'details'].includes(value)),
        normalized.some((value) => ['quantity', 'qty', 'count'].includes(value))
      ].filter(Boolean).length;
      if (signalCount >= 3) return 40;
      if (signalCount === 2) {
        bestRowScore = Math.max(bestRowScore, 30);
        continue;
      }
      if (
        normalized.some((value) =>
          ['supplier', 'vendor', 'manufacturer', 'units', 'unit', 'uom', 'cost', 'unitcost', 'category'].includes(value)
        )
      ) {
        bestRowScore = Math.max(bestRowScore, 15);
      }
    }

    return bestRowScore;
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  }

  private extensionOf(name: string): string {
    const idx = name.lastIndexOf('.');
    if (idx < 0) return '';
    return name.slice(idx).toLowerCase();
  }
}
