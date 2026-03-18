import { Module, forwardRef } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { DiffModule } from '../diff/diff.module';
import { SharesModule } from '../shares/shares.module';
import { UploadsController } from './uploads.controller';
import { HistoryController } from './history.controller';
import { UploadHistoryService } from './upload-history.service';
import { UploadJobService } from './upload-job.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadQueueService } from './upload-queue.service';
import { UploadRevisionService } from './upload-revision.service';
import { UploadValidationService } from './upload-validation.service';

@Module({
  imports: [AuditModule, SharesModule, forwardRef(() => DiffModule)],
  controllers: [UploadsController, HistoryController],
  providers: [
    UploadValidationService,
    UploadPolicyService,
    UploadJobService,
    UploadQueueService,
    UploadHistoryService,
    UploadRevisionService,
    SessionAuthGuard
  ],
  exports: [UploadHistoryService, UploadRevisionService, UploadPolicyService]
})
export class UploadsModule {}
