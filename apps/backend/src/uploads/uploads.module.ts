import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { UploadsController } from './uploads.controller';
import { UploadValidationService } from './upload-validation.service';

@Module({
  imports: [AuditModule],
  controllers: [UploadsController],
  providers: [UploadValidationService, SessionAuthGuard]
})
export class UploadsModule {}
