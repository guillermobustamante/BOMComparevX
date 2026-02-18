import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { MappingController } from './mapping.controller';
import { MappingDetectionService } from './mapping-detection.service';
import { MappingPreviewService } from './mapping-preview.service';
import { SemanticRegistryService } from './semantic-registry.service';

@Module({
  imports: [AuditModule],
  controllers: [MappingController],
  providers: [SemanticRegistryService, MappingDetectionService, MappingPreviewService, SessionAuthGuard],
  exports: [SemanticRegistryService, MappingDetectionService, MappingPreviewService]
})
export class MappingModule {}
