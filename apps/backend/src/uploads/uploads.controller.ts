import {
  Controller,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { AuditService } from '../audit/audit.service';
import { UploadWorkbookMetadataService } from './upload-workbook-metadata.service';
import { UploadHistoryService } from './upload-history.service';
import { UploadJobService } from './upload-job.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadQueueService } from './upload-queue.service';
import { UploadRevisionService } from './upload-revision.service';
import { UploadValidationService } from './upload-validation.service';
import { BomRegionWarning } from './bom-region-detection.service';

interface UploadSheetSelections {
  fileA: string | null;
  fileB: string | null;
}

interface UploadValidationWarning extends BomRegionWarning {
  file?: 'fileA' | 'fileB';
  selectedSheetName?: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadValidationService: UploadValidationService,
    private readonly uploadPolicyService: UploadPolicyService,
    private readonly uploadJobService: UploadJobService,
    private readonly uploadQueueService: UploadQueueService,
    private readonly uploadHistoryService: UploadHistoryService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly uploadWorkbookMetadataService: UploadWorkbookMetadataService,
    private readonly auditService: AuditService
  ) {}

  @Post('workbook-metadata')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async workbookMetadata(
    @UploadedFile()
    file: Express.Multer.File | undefined
  ) {
    if (!file) {
      throw new HttpException(
        {
          code: 'UPLOAD_WORKBOOK_METADATA_FILE_REQUIRED',
          message: 'A file is required to inspect workbook sheets.'
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.uploadWorkbookMetadataService.inspectFile(file);
  }

  @Post('validate')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileA', maxCount: 1 },
      { name: 'fileB', maxCount: 1 }
    ])
  )
  async validate(
    @Req() req: Request,
    @UploadedFiles()
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    }
  ): Promise<{
    accepted: true;
    correlationId: string;
    files: {
      fileA: { name: string; size: number };
      fileB: { name: string; size: number };
    };
    warnings: UploadValidationWarning[];
    fallbackParserUsed: boolean;
    sheetSelections: UploadSheetSelections;
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
      isUnlimited: boolean;
    };
  }> {
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const sessionId = this.readSessionId(req);
    const sheetSelections = this.readSheetSelections(req);
    const validationResult = sessionId
      ? await this.validateChainedFilesAsync(tenantId, sessionId, files, sheetSelections.fileB)
      : await this.validatePairWithAnalysisAsync(files, sheetSelections);
    const policy = await this.uploadPolicyService.registerAcceptedValidation(userKey, tenantId);
    this.auditService.emit({
      eventType: 'auth.login.success',
      outcome: 'success',
      actorEmail: userKey,
      tenantId,
      reason: 'upload.validate.accepted',
      correlationId: validationResult.correlationId
    });
    return {
      ...validationResult,
      policy,
      sheetSelections
    };
  }

  @Post('intake')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileA', maxCount: 1 },
      { name: 'fileB', maxCount: 1 }
    ])
  )
  async intake(
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-test-queue-fail') testQueueFail: string | undefined,
    @UploadedFiles()
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    }
  ): Promise<{
    jobId: string;
    sessionId: string;
    leftRevisionId: string | null;
    rightRevisionId: string | null;
    historyId: string | null;
    status: 'accepted';
    correlationId: string;
    idempotentReplay: boolean;
    warnings: UploadValidationWarning[];
    fallbackParserUsed: boolean;
    sheetSelections: UploadSheetSelections;
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
      isUnlimited: boolean;
    };
  }> {
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const sessionId = this.readSessionId(req);
    const sheetSelections = this.readSheetSelections(req);

    if (idempotencyKey) {
      const existing = await this.uploadJobService.findByIdempotency(userKey, idempotencyKey);
      if (existing) {
        const existingHistory = await this.uploadHistoryService.findByJobId(existing.jobId, tenantId);
        return {
          ...this.acceptedResponse(
            existing,
            existingHistory?.historyId || null,
            true,
            await this.uploadRevisionService.findPairByJobId(tenantId, existing.jobId)
          ),
          warnings: [],
          fallbackParserUsed: false,
          sheetSelections
        };
      }
    }

    const validationResult = sessionId
      ? await this.validateChainedFilesAsync(tenantId, sessionId, files, sheetSelections.fileB)
      : await this.validatePairWithAnalysisAsync(files, sheetSelections);
    const policy = await this.uploadPolicyService.registerAcceptedValidation(userKey, tenantId);
    const job = await this.uploadJobService.createAcceptedJob({
      tenantId,
      requestedBy: userKey,
      sessionId: sessionId || undefined,
      idempotencyKey,
      files: validationResult.files,
      policy
    });

    const enqueuedMessage = this.uploadQueueService.enqueueAcceptedJob(job);
    const queueResult = await this.uploadQueueService.processAcceptedJobWithRetry(
      enqueuedMessage,
      this.uploadJobService,
      {
      forceFailure: process.env.NODE_ENV === 'test' && testQueueFail === 'always'
      }
    );
    if (!queueResult.queued) {
      this.auditService.emit({
        eventType: 'auth.login.failure',
        outcome: 'failure',
        actorEmail: userKey,
        tenantId,
        reason: 'upload.intake.queue_failed',
        correlationId: job.correlationId
      });
      throw new HttpException(
        {
          code: 'UPLOAD_QUEUE_ENQUEUE_FAILED',
          message: 'Upload was validated but queueing failed after retries.',
          correlationId: job.correlationId
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const historyEntry = await this.uploadHistoryService.createAcceptedUploadEntry(job);
    const fileA = files.fileA?.[0];
    const fileB = files.fileB?.[0];
    const revisionPair =
      sessionId && fileB
        ? await this.uploadRevisionService.storeChainedRevisionPair({
            tenantId,
            sessionId,
            jobId: job.jobId,
            fileB,
            fileBSheetName: sheetSelections.fileB || undefined
          })
        : fileA && fileB
        ? await this.uploadRevisionService.storeRevisionPair({
            tenantId,
            sessionId: job.sessionId,
            jobId: job.jobId,
            fileA,
            fileB,
            fileASheetName: sheetSelections.fileA || undefined,
            fileBSheetName: sheetSelections.fileB || undefined
          })
        : null;
    this.auditService.emit({
      eventType: 'auth.login.success',
      outcome: 'success',
      actorEmail: userKey,
      tenantId,
      reason: 'upload.intake.accepted',
      correlationId: job.correlationId
    });
    return {
      ...this.acceptedResponse(job, historyEntry.historyId, false, revisionPair),
      warnings: validationResult.warnings,
      fallbackParserUsed: validationResult.fallbackParserUsed,
      sheetSelections
    };
  }

  private readSessionId(req: Request): string | null {
    const raw = (req.body as { sessionId?: string } | undefined)?.sessionId;
    const sessionId = typeof raw === 'string' ? raw.trim() : '';
    return sessionId || null;
  }

  private async validateChainedFilesAsync(
    tenantId: string,
    sessionId: string,
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    },
    fileBSheetName: string | null
  ) {
    const latestPair = await this.uploadRevisionService.findLatestPairBySession(tenantId, sessionId);
    const baseline = latestPair
      ? await this.uploadRevisionService.getRevisionFileMeta(tenantId, latestPair.rightRevisionId)
      : null;

    if (!latestPair || !baseline) {
      throw new HttpException(
        {
          code: 'UPLOAD_SESSION_NOT_FOUND',
          message: 'Could not find the latest comparison file for this session.'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const validation = this.uploadValidationService.validateChainedFollowUp(files, {
      name: baseline.fileName,
      size: baseline.fileSize
    });
    const fileB = files.fileB?.[0];
    const analysis = fileB
      ? this.uploadRevisionService.analyzeFile(fileB, 'B', {
          selectedSheetName: fileBSheetName || undefined
        })
      : null;
    return {
      ...validation,
      warnings: this.toWarnings(analysis?.warnings || [], 'fileB', analysis?.sheetName || fileBSheetName || undefined),
      fallbackParserUsed: analysis?.fallbackParserUsed || false
    };
  }

  private async validatePairWithAnalysisAsync(
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    },
    sheetSelections: UploadSheetSelections
  ) {
    const validation = this.uploadValidationService.validatePair(files);
    const fileA = files.fileA?.[0];
    const fileB = files.fileB?.[0];
    const analysisA = fileA
      ? this.uploadRevisionService.analyzeFile(fileA, 'A', {
          selectedSheetName: sheetSelections.fileA || undefined
        })
      : null;
    const analysisB = fileB
      ? this.uploadRevisionService.analyzeFile(fileB, 'B', {
          selectedSheetName: sheetSelections.fileB || undefined
        })
      : null;

    return {
      ...validation,
      warnings: [
        ...this.toWarnings(analysisA?.warnings || [], 'fileA', analysisA?.sheetName || sheetSelections.fileA || undefined),
        ...this.toWarnings(analysisB?.warnings || [], 'fileB', analysisB?.sheetName || sheetSelections.fileB || undefined)
      ],
      fallbackParserUsed: Boolean(analysisA?.fallbackParserUsed || analysisB?.fallbackParserUsed)
    };
  }

  private toWarnings(
    warnings: BomRegionWarning[],
    file: 'fileA' | 'fileB',
    selectedSheetName?: string
  ): UploadValidationWarning[] {
    return warnings.map((warning) => ({
      ...warning,
      file,
      selectedSheetName
    }));
  }

  private readSheetSelections(req: Request): UploadSheetSelections {
    const body = (req.body as { fileASheetName?: string; fileBSheetName?: string } | undefined) || {};
    const normalize = (value: string | undefined): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed || trimmed.toUpperCase() === 'CSV') return trimmed || null;
      return trimmed;
    };
    return {
      fileA: normalize(body.fileASheetName),
      fileB: normalize(body.fileBSheetName)
    };
  }

  private acceptedResponse(
    job: {
      jobId: string;
      sessionId: string;
      status: 'accepted' | 'queued';
      correlationId: string;
      policy: {
        comparisonsUsed: number;
        unrestrictedComparisonsRemaining: number;
        cooldownUntilUtc: string | null;
        isUnlimited: boolean;
      };
    },
    historyId: string | null,
    idempotentReplay: boolean,
    revisionPair: { leftRevisionId: string; rightRevisionId: string } | null
  ): {
    jobId: string;
    sessionId: string;
    leftRevisionId: string | null;
    rightRevisionId: string | null;
    historyId: string | null;
    status: 'accepted';
    correlationId: string;
    idempotentReplay: boolean;
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
      isUnlimited: boolean;
    };
  } {
    return {
      jobId: job.jobId,
      sessionId: job.sessionId,
      leftRevisionId: revisionPair?.leftRevisionId || null,
      rightRevisionId: revisionPair?.rightRevisionId || null,
      historyId,
      status: 'accepted',
      correlationId: job.correlationId,
      idempotentReplay,
      policy: job.policy
    };
  }
}
