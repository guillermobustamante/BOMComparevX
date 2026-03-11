import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { MappingModule } from '../mapping/mapping.module';
import { RetentionModule } from '../retention/retention.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminController } from './admin.controller';
import { AdminRoleService } from './admin-role.service';

@Module({
  imports: [UploadsModule, AuditModule, RetentionModule, MappingModule],
  controllers: [AdminController],
  providers: [AdminRoleService, SessionAuthGuard],
  exports: [AdminRoleService]
})
export class AdminModule {}
