import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExportsModule } from '../exports/exports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SharesModule } from '../shares/shares.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [AuditModule, ExportsModule, NotificationsModule, SharesModule],
  providers: [RetentionService],
  exports: [RetentionService]
})
export class RetentionModule {}
