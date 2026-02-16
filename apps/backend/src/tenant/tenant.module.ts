import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantScopeGuard } from './tenant-scope.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TenantController],
  providers: [TenantResolverService, TenantScopeGuard],
  exports: [TenantResolverService, TenantScopeGuard]
})
export class TenantModule {}
