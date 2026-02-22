import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuditModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SessionAuthGuard],
  exports: [NotificationsService]
})
export class NotificationsModule {}
