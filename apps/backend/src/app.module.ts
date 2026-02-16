import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [ConfigModule, AuthModule, TenantModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
