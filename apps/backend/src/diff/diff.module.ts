import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { MappingModule } from '../mapping/mapping.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SharesModule } from '../shares/shares.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ClassificationService } from './classification.service';
import { DiffController } from './diff.controller';
import { DiffComputationService } from './diff-computation.service';
import { DiffFeatureFlagService } from './feature-flag.service';
import { DiffJobService } from './diff-job.service';
import { MatcherService } from './matcher.service';
import { NormalizationService } from './normalization.service';
import { ProfileAdapterService } from './profile-adapter.service';

@Module({
  imports: [AuditModule, UploadsModule, SharesModule, NotificationsModule, MappingModule],
  controllers: [DiffController],
  providers: [
    NormalizationService,
    DiffFeatureFlagService,
    ProfileAdapterService,
    MatcherService,
    ClassificationService,
    DiffComputationService,
    DiffJobService,
    SessionAuthGuard
  ],
  exports: [
    NormalizationService,
    DiffFeatureFlagService,
    ProfileAdapterService,
    MatcherService,
    ClassificationService,
    DiffComputationService,
    DiffJobService
  ]
})
export class DiffModule {}
