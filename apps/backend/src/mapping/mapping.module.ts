import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { MappingAuditService } from './mapping-audit.service';
import { MappingController } from './mapping.controller';
import { MappingDetectionService } from './mapping-detection.service';
import { MappingPersistenceService } from './mapping-persistence.service';
import { MappingPreviewService } from './mapping-preview.service';
import { SemanticRegistryService } from './semantic-registry.service';

@Module({
  imports: [AuditModule],
  controllers: [MappingController],
  providers: [
    SemanticRegistryService,
    MappingDetectionService,
    MappingPreviewService,
    MappingPersistenceService,
    MappingAuditService,
    SessionAuthGuard
  ],
  exports: [
    SemanticRegistryService,
    MappingDetectionService,
    MappingPreviewService,
    MappingPersistenceService,
    MappingAuditService
  ]
})
export class MappingModule {}
