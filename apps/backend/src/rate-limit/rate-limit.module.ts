import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [AuditModule],
  providers: [
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    }
  ]
})
export class RateLimitModule {}

