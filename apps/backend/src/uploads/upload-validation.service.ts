import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

export interface UploadValidationResult {
  accepted: true;
  correlationId: string;
  policy?: {
    comparisonsUsed: number;
    unrestrictedComparisonsRemaining: number;
    cooldownUntilUtc: string | null;
  };
  files: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
  };
}

@Injectable()
export class UploadValidationService {
  validate(files: { fileA?: Express.Multer.File[]; fileB?: Express.Multer.File[] }): UploadValidationResult {
    const correlationId = randomUUID();
    const fileA = files.fileA?.[0];
    const fileB = files.fileB?.[0];

    if (!fileA || !fileB || (files.fileA?.length || 0) !== 1 || (files.fileB?.length || 0) !== 1) {
      throw this.error(
        'UPLOAD_FILE_COUNT_INVALID',
        'Exactly two files are required: fileA and fileB.',
        correlationId
      );
    }

    this.validateSingleFile(fileA, correlationId);
    this.validateSingleFile(fileB, correlationId);

    return {
      accepted: true,
      correlationId,
      files: {
        fileA: { name: fileA.originalname, size: fileA.size },
        fileB: { name: fileB.originalname, size: fileB.size }
      }
    };
  }

  private validateSingleFile(file: Express.Multer.File, correlationId: string): void {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw this.error(
        'UPLOAD_FILE_SIZE_EXCEEDED',
        `File "${file.originalname}" exceeds the 30MB size limit.`,
        correlationId
      );
    }

    const ext = this.extensionOf(file.originalname);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      throw this.error(
        'UPLOAD_FILE_TYPE_INVALID',
        `File "${file.originalname}" must be CSV, XLS, or XLSX.`,
        correlationId
      );
    }
  }

  private extensionOf(name: string): string | undefined {
    const idx = name.lastIndexOf('.');
    if (idx < 0 || idx === name.length - 1) return undefined;
    return name.slice(idx).toLowerCase();
  }

  private error(code: string, message: string, correlationId: string): BadRequestException {
    return new BadRequestException({ code, message, correlationId });
  }
}
