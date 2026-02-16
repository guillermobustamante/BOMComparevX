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
import { UploadHistoryService } from './upload-history.service';
import { UploadJobService } from './upload-job.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadQueueService } from './upload-queue.service';
import { UploadValidationService } from './upload-validation.service';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadValidationService: UploadValidationService,
    private readonly uploadPolicyService: UploadPolicyService,
    private readonly uploadJobService: UploadJobService,
    private readonly uploadQueueService: UploadQueueService,
    private readonly uploadHistoryService: UploadHistoryService
  ) {}

  @Post('validate')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileA', maxCount: 1 },
      { name: 'fileB', maxCount: 1 }
    ])
  )
  validate(
    @Req() req: Request,
    @UploadedFiles()
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    }
  ) {
    const validationResult = this.uploadValidationService.validate(files);
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const policy = this.uploadPolicyService.registerAcceptedValidation(userKey);
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
  intake(
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-test-queue-fail') testQueueFail: string | undefined,
    @UploadedFiles()
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    }
  ) {
    const session = req.session as SessionState;
    const userKey = session.user?.email || 'unknown-user';
    const tenantId = session.user?.tenantId || 'unknown-tenant';

    if (idempotencyKey) {
      const existing = this.uploadJobService.findByIdempotency(userKey, idempotencyKey);
      if (existing) {
        const existingHistory = this.uploadHistoryService.findByJobId(existing.jobId);
        return this.acceptedResponse(existing, existingHistory?.historyId || null, true);
      }
    }

    const validationResult = this.uploadValidationService.validate(files);
    const policy = this.uploadPolicyService.registerAcceptedValidation(userKey);
    const job = this.uploadJobService.createAcceptedJob({
      tenantId,
      requestedBy: userKey,
      idempotencyKey,
      files: validationResult.files,
      policy
    });

    const enqueuedMessage = this.uploadQueueService.enqueueAcceptedJob(job);
    const queueResult = this.uploadQueueService.processAcceptedJobWithRetry(enqueuedMessage, this.uploadJobService, {
      forceFailure: process.env.NODE_ENV === 'test' && testQueueFail === 'always'
    });
    if (!queueResult.queued) {
      throw new HttpException(
        {
          code: 'UPLOAD_QUEUE_ENQUEUE_FAILED',
          message: 'Upload was validated but queueing failed after retries.',
          correlationId: job.correlationId
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const historyEntry = this.uploadHistoryService.createAcceptedUploadEntry(job);
    return this.acceptedResponse(job, historyEntry.historyId, false);
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
    idempotentReplay: boolean
  ) {
    return {
      jobId: job.jobId,
      sessionId: job.sessionId,
      historyId,
      status: 'accepted',
      correlationId: job.correlationId,
      idempotentReplay,
      policy: job.policy
    };
  }
}
