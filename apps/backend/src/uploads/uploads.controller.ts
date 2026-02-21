import {
  Controller,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { AuditService } from '../audit/audit.service';
import { UploadHistoryService } from './upload-history.service';
import { UploadJobService } from './upload-job.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadQueueService } from './upload-queue.service';
import { UploadRevisionService } from './upload-revision.service';
import { UploadValidationService } from './upload-validation.service';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadValidationService: UploadValidationService,
    private readonly uploadPolicyService: UploadPolicyService,
    private readonly uploadJobService: UploadJobService,
    private readonly uploadQueueService: UploadQueueService,
    private readonly uploadHistoryService: UploadHistoryService,
    private readonly uploadRevisionService: UploadRevisionService,
    private readonly auditService: AuditService
  ) {}

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
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
    };
  }> {
    const validationResult = this.uploadValidationService.validate(files);
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const tenantId = session.user?.tenantId || 'unknown-tenant';
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
      policy
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
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
    };
  }> {
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const tenantId = session.user?.tenantId || 'unknown-tenant';

    if (idempotencyKey) {
      const existing = await this.uploadJobService.findByIdempotency(userKey, idempotencyKey);
      if (existing) {
        const existingHistory = await this.uploadHistoryService.findByJobId(existing.jobId, tenantId);
        return this.acceptedResponse(
          existing,
          existingHistory?.historyId || null,
          true,
          this.uploadRevisionService.findPairByJobId(tenantId, existing.jobId)
        );
      }
    }

    const validationResult = this.uploadValidationService.validate(files);
    const policy = await this.uploadPolicyService.registerAcceptedValidation(userKey, tenantId);
    const job = await this.uploadJobService.createAcceptedJob({
      tenantId,
      requestedBy: userKey,
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
      fileA && fileB
        ? this.uploadRevisionService.storeRevisionPair({
            tenantId,
            sessionId: job.sessionId,
            jobId: job.jobId,
            fileA,
            fileB
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
    return this.acceptedResponse(job, historyEntry.historyId, false, revisionPair);
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
