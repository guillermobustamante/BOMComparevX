import { Module } from '@nestjs/common';
import { AuditGovernanceService } from './audit-governance.service';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService, AuditGovernanceService],
  exports: [AuditService, AuditGovernanceService]
})
export class AuditModule {}
