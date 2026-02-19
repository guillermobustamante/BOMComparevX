import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { ClassificationService } from './classification.service';
import { DiffController } from './diff.controller';
import { DiffComputationService } from './diff-computation.service';
import { DiffJobService } from './diff-job.service';
import { MatcherService } from './matcher.service';
import { NormalizationService } from './normalization.service';

@Module({
  imports: [AuditModule],
  controllers: [DiffController],
  providers: [
    NormalizationService,
    MatcherService,
    ClassificationService,
    DiffComputationService,
    DiffJobService,
    SessionAuthGuard
  ],
  exports: [
    NormalizationService,
    MatcherService,
    ClassificationService,
    DiffComputationService,
    DiffJobService
  ]
})
export class DiffModule {}
