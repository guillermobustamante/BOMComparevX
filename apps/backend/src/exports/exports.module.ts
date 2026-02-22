import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { DiffModule } from '../diff/diff.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AuditModule, DiffModule],
  controllers: [ExportsController],
  providers: [ExportsService, SessionAuthGuard],
  exports: [ExportsService]
})
export class ExportsModule {}
