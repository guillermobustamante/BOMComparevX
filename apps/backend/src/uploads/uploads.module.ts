import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { UploadsController } from './uploads.controller';
import { UploadHistoryService } from './upload-history.service';
import { UploadJobService } from './upload-job.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadQueueService } from './upload-queue.service';
import { UploadRevisionService } from './upload-revision.service';
import { UploadValidationService } from './upload-validation.service';

@Module({
  imports: [AuditModule],
  controllers: [UploadsController],
  providers: [
    UploadValidationService,
    UploadPolicyService,
    UploadJobService,
    UploadQueueService,
    UploadHistoryService,
    UploadRevisionService,
    SessionAuthGuard
  ],
  exports: [UploadHistoryService, UploadRevisionService]
})
export class UploadsModule {}
