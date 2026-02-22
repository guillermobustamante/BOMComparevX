import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [AuditModule],
  controllers: [SharesController],
  providers: [SharesService, SessionAuthGuard],
  exports: [SharesService]
})
export class SharesModule {}
